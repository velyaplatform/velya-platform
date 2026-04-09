# Seguranca e Controle de Acesso para Timeline do Paciente

> Modelo de seguranca baseado em RBAC + ABAC + contexto do encontro para protecao da timeline clinica do paciente.

## 1. Visao Geral

A timeline do paciente contem a projecao cronologica completa de todos os eventos clinicos, operacionais e administrativos de um encontro (internacao, consulta, emergencia). Por conter dados sensiveis de saude (LGPD Art. 11), o acesso deve seguir principios rigorosos de minimizacao, rastreabilidade e proporcionalidade.

Este documento define:
1. O modelo de autorizacao (RBAC + ABAC + contexto).
2. A trilha de acesso completa.
3. Views segmentadas por papel.
4. Break-glass auditado.
5. Consentimento do paciente.
6. Logs imutaveis.
7. Exportacao controlada.
8. Mascaramento por papel.

---

## 2. Modelo de Autorizacao: RBAC + ABAC + Contexto

### 2.1 Camadas de Autorizacao

```
┌─────────────────────────────────────────────────────────────┐
│ Camada 1: RBAC (Role-Based Access Control)                  │
│ Quem e o usuario? Qual seu papel institucional?             │
│ Ex: Medico, Enfermeiro, Farmaceutico, Administrador         │
├─────────────────────────────────────────────────────────────┤
│ Camada 2: ABAC (Attribute-Based Access Control)             │
│ Quais atributos contextuais se aplicam?                     │
│ Ex: Unidade de trabalho, turno, especialidade, vinculo      │
├─────────────────────────────────────────────────────────────┤
│ Camada 3: Contexto do Encontro                              │
│ O usuario tem vinculo ativo com este paciente/encontro?     │
│ Ex: CareTeam member, consultor solicitado, cobertura        │
├─────────────────────────────────────────────────────────────┤
│ Camada 4: Politica de Minimizacao                           │
│ Dado que tem acesso, o que realmente precisa ver?           │
│ Ex: Farmaceutico ve medicamentos, nao ve notas psiquiatricas│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Decisao de Acesso

Para cada requisicao de acesso a timeline:

```
FUNCAO avaliarAcesso(usuario, paciente, recurso, acao):
  // Camada 1: RBAC
  SE usuario.papel NAO TEM permissao para acao no tipo de recurso:
    NEGAR(motivo='rbac_denied')
  
  // Camada 2: ABAC
  SE recurso requer atributo especifico (ex: mesma unidade) E usuario nao possui:
    SE usuario.papel NAO permite acesso cross-unit:
      NEGAR(motivo='abac_unit_mismatch')
  
  // Camada 3: Contexto do Encontro
  SE usuario NAO e membro do CareTeam do encontro ativo:
    SE usuario NAO tem papel de coordenacao/supervisao/auditoria:
      SE usuario NAO tem break-glass ativo:
        NEGAR(motivo='no_encounter_context')
  
  // Camada 4: Minimizacao
  recursoFiltrado = aplicarMascaramento(recurso, usuario.papel, usuario.atributos)
  
  // Registrar acesso
  registrarAuditEvent(usuario, paciente, recurso, acao, resultado='permitido')
  
  PERMITIR(recursoFiltrado)
```

### 2.3 Vinculo com o Encontro (CareTeam Context)

O vinculo e o requisito central. Um profissional tem acesso a timeline de um paciente se:

| Tipo de Vinculo | Descricao | Duracao |
|---|---|---|
| **CareTeam.member** | Membro ativo da equipe assistencial | Enquanto membro ativo |
| **Consultor solicitado** | Interconsulta solicitada e aceita | Ate alta da consultoria |
| **Cobertura de turno** | Profissional cobrindo turno de outro | Durante o turno coberto |
| **Supervisor** | Coordenador da unidade onde o paciente esta | Enquanto na unidade |
| **Auditoria** | Papel de auditoria/qualidade | Com justificativa, por sessao |
| **Emergencia (break-glass)** | Acesso emergencial | Limitado (ver secao 7) |

---

## 3. Trilha de Acesso Completa

### 3.1 O Que e Registrado

Cada interacao com a timeline gera um `AuditEvent` FHIR contendo:

| Campo | Descricao | Exemplo |
|---|---|---|
| **who** | Quem acessou | `Practitioner/dr-silva` |
| **what** | Qual recurso | `Patient/12345/timeline` |
| **when** | Quando | `2026-04-09T14:32:18Z` |
| **where** | De onde (IP, dispositivo, localizacao) | `192.168.1.45, workstation-uti-03` |
| **why** | Motivo/contexto | `CareTeam member, turno diurno` |
| **action** | Tipo de acao | `read`, `filter`, `expand`, `export`, `sign` |
| **outcome** | Resultado | `success`, `denied` |
| **duration** | Tempo de visualizacao | `180 seconds` |
| **detail.filter** | Filtros aplicados | `type=medication, date=2026-04-08` |
| **detail.expanded** | Registros expandidos (detalhados) | `MedicationAdministration/789` |
| **detail.altered** | Campos alterados (se edicao) | `note.text: old -> new` |
| **detail.exported** | Dados exportados | `timeline_pdf_24h` |
| **detail.signed** | Documentos assinados | `DocumentReference/456` |

### 3.2 Exemplo de AuditEvent FHIR

```json
{
  "resourceType": "AuditEvent",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110110",
    "display": "Patient Record"
  },
  "subtype": [
    {
      "system": "http://velya.health/audit-subtypes",
      "code": "timeline-view",
      "display": "Patient Timeline Viewed"
    }
  ],
  "action": "R",
  "period": {
    "start": "2026-04-09T14:32:18Z",
    "end": "2026-04-09T14:35:42Z"
  },
  "recorded": "2026-04-09T14:35:42Z",
  "outcome": "0",
  "agent": [
    {
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/extra-security-role-type",
            "code": "humanuser"
          }
        ]
      },
      "who": {
        "reference": "Practitioner/dr-silva",
        "display": "Dra. Ana Silva - CRM 12345/SP"
      },
      "requestor": true,
      "network": {
        "address": "192.168.1.45",
        "type": "2"
      },
      "purposeOfUse": [
        {
          "coding": [
            {
              "system": "http://velya.health/purpose-of-use",
              "code": "treatment",
              "display": "Assistencia direta ao paciente"
            }
          ]
        }
      ]
    }
  ],
  "source": {
    "observer": {
      "reference": "Device/velya-timeline-service"
    }
  },
  "entity": [
    {
      "what": {
        "reference": "Patient/12345"
      },
      "type": {
        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
        "code": "1",
        "display": "Person"
      },
      "role": {
        "system": "http://terminology.hl7.org/CodeSystem/object-role",
        "code": "1",
        "display": "Patient"
      },
      "detail": [
        {
          "type": "timeline_filters_applied",
          "valueString": "type=all,date_range=24h"
        },
        {
          "type": "records_expanded",
          "valueString": "MedicationAdministration/789,Observation/456"
        },
        {
          "type": "session_duration_seconds",
          "valueString": "204"
        }
      ]
    }
  ]
}
```

### 3.3 Retencao da Trilha de Acesso

| Tipo de Evento | Retencao Minima | Storage |
|---|---|---|
| Acesso a timeline (leitura) | 5 anos | Cold storage apos 1 ano |
| Alteracao de dados | 20 anos | Imutavel, assinatura digital |
| Exportacao de dados | 20 anos | Imutavel |
| Break-glass | 20 anos | Imutavel, alerta permanente |
| Acesso negado | 2 anos | Cold storage apos 6 meses |

---

## 4. Views Segmentadas por Papel

### 4.1 Principio

Cada papel visualiza a timeline com uma "lente" diferente, mostrando os eventos relevantes para sua funcao e ocultando ou mascarando os demais.

### 4.2 Matriz de Visibilidade por Tipo de Evento

| Tipo de Evento | Medico Assistente | Enfermeiro | Tec. Enfermagem | Farmaceutico | Fisioterapeuta | Nutricionista | Assistente Social | Admin/Faturamento |
|---|---|---|---|---|---|---|---|---|
| Evolucao medica | Completo | Resumo | Resumo | Resumo med | N/A | Resumo dieta | N/A | N/A |
| Evolucao enfermagem | Completo | Completo | Completo | Resumo | Resumo mobilidade | Resumo | N/A | N/A |
| Prescricao medica | Completo | Completo | Itens atribuidos | Completo | Itens relevantes | Itens dieta | N/A | Codigos/quantidades |
| Administracao med. | Completo | Completo | Completo | Completo | N/A | N/A | N/A | Codigos/horarios |
| Resultados lab. | Completo | Resumo | N/A | Relevantes | N/A | Relevantes | N/A | N/A |
| Sinais vitais | Completo | Completo | Completo | Resumo | Relevantes | N/A | N/A | N/A |
| Notas psiquiatricas | Se psiquiatra | N/A | N/A | N/A | N/A | N/A | Resumo social | N/A |
| Dados sociais | Resumo | Resumo | N/A | N/A | N/A | N/A | Completo | N/A |
| Faturamento/custos | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Completo |
| Handoffs | Proprios | Proprios | Proprios | N/A | Proprios | Proprios | N/A | N/A |
| Consentimentos | Completo | Status | N/A | N/A | Status | Status | Status | Status |
| Alertas/alergias | Completo | Completo | Completo | Completo | Relevantes | Relevantes | N/A | N/A |

**Legenda**:
- **Completo**: Todos os campos visiveis.
- **Resumo**: Informacao sintetizada, sem detalhes narrativos.
- **Relevantes**: Apenas registros pertinentes a funcao.
- **N/A**: Sem acesso (nao exibido na timeline).
- **Proprios**: Apenas registros onde o profissional e ator.

### 4.3 Implementacao Tecnica

```typescript
interface TimelineViewPolicy {
  role: string;
  eventTypeRules: EventTypeRule[];
  fieldMaskRules: FieldMaskRule[];
  defaultVisibility: 'visible' | 'hidden' | 'masked';
}

interface EventTypeRule {
  eventType: string;
  visibility: 'full' | 'summary' | 'relevant_only' | 'own_only' | 'hidden';
  relevanceFilter?: (event: TimelineEvent, viewer: Practitioner) => boolean;
  summaryFields?: string[];
}

interface FieldMaskRule {
  fieldPath: string;
  maskedForRoles: string[];
  maskType: 'redact' | 'generalize' | 'pseudonymize' | 'hide';
  maskValue?: string;
}

// Exemplo: politica para farmaceutico
const pharmacistPolicy: TimelineViewPolicy = {
  role: 'pharmacist',
  eventTypeRules: [
    { eventType: 'MedicationRequest', visibility: 'full' },
    { eventType: 'MedicationAdministration', visibility: 'full' },
    { eventType: 'MedicationDispense', visibility: 'full' },
    { eventType: 'AllergyIntolerance', visibility: 'full' },
    { eventType: 'DiagnosticReport', visibility: 'relevant_only',
      relevanceFilter: (e, v) => e.category === 'laboratory' &&
        ['renal_function', 'hepatic_function', 'drug_levels'].includes(e.subcategory)
    },
    { eventType: 'DocumentReference:progress_note', visibility: 'summary',
      summaryFields: ['medications_mentioned', 'allergies_mentioned'] },
    { eventType: 'DocumentReference:psychiatric_note', visibility: 'hidden' },
    { eventType: 'Observation:social_history', visibility: 'hidden' },
  ],
  fieldMaskRules: [
    { fieldPath: 'patient.address', maskedForRoles: ['pharmacist'], maskType: 'hide' },
    { fieldPath: 'patient.contact.phone', maskedForRoles: ['pharmacist'], maskType: 'hide' },
  ],
  defaultVisibility: 'hidden',
};
```

---

## 5. Minimizacao de Dados

### 5.1 Principio LGPD

Art. 6, III — "limitacao do tratamento ao minimo necessario para a realizacao de suas finalidades, com abrangencia dos dados pertinentes, proporcionais e nao excessivos em relacao as finalidades do tratamento de dados."

### 5.2 Aplicacao na Timeline

1. **Filtro por papel**: O sistema aplica automaticamente filtros de tipo de evento conforme a secao 4.
2. **Filtro por atributo**: Dentro dos eventos visiveis, campos nao necessarios sao mascarados.
3. **Filtro temporal**: Acesso padrao limitado ao encontro atual. Historico requer justificativa.
4. **Aggregacao**: Para papeis de gestao/auditoria, dados podem ser apresentados agregados antes de detalhados.
5. **Lazy loading**: Detalhes de eventos so sao carregados (e registrados na trilha) quando o usuario expande explicitamente.

### 5.3 Niveis de Detalhe

| Nivel | Informacao | Quando |
|---|---|---|
| **L0 - Existencia** | "Existe evolucao medica em 09/04" | View padrao para papel sem acesso ao conteudo |
| **L1 - Resumo** | "Evolucao: paciente estavel, mantida prescricao" | View padrao para papeis com acesso parcial |
| **L2 - Completo** | Texto integral da evolucao | View para papel com acesso total |
| **L3 - Provenance** | Texto + metadados de autoria, versao, alteracoes | View para auditoria |

---

## 6. Consentimento do Paciente

### 6.1 Consentimento para Acesso a Timeline

| Tipo | Descricao | Padrao |
|---|---|---|
| **Assistencial** | Acesso pela equipe de cuidado direta | Opt-in na admissao (obrigatorio para internacao) |
| **Interconsulta** | Acesso por consultor solicitado | Automatico quando interconsulta e aceita |
| **Pesquisa** | Acesso para fins de pesquisa | Opt-in explicito, com aprovacao CEP |
| **Educacional** | Acesso para ensino/residencia | Opt-in explicito, com anonimizacao |
| **Familiar** | Visualizacao por familiares autorizados | Opt-in explicito por paciente, por familiar |
| **Segundo opiniao** | Compartilhamento com profissional externo | Opt-in explicito, com escopo e prazo |

### 6.2 Recurso FHIR: Consent

```json
{
  "resourceType": "Consent",
  "status": "active",
  "scope": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/consentscope",
        "code": "patient-privacy",
        "display": "Privacy Consent"
      }
    ]
  },
  "category": [
    {
      "coding": [
        {
          "system": "http://velya.health/consent-category",
          "code": "timeline-access",
          "display": "Acesso a Timeline do Paciente"
        }
      ]
    }
  ],
  "patient": {
    "reference": "Patient/12345"
  },
  "dateTime": "2026-04-09T08:00:00Z",
  "performer": [
    {
      "reference": "Patient/12345"
    }
  ],
  "provision": {
    "type": "permit",
    "period": {
      "start": "2026-04-09T08:00:00Z"
    },
    "actor": [
      {
        "role": {
          "coding": [
            {
              "system": "http://velya.health/consent-actor-role",
              "code": "care-team",
              "display": "Equipe Assistencial"
            }
          ]
        },
        "reference": {
          "reference": "CareTeam/encounter-12345-team"
        }
      }
    ],
    "action": [
      {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/consentaction",
            "code": "access",
            "display": "Access"
          }
        ]
      }
    ],
    "purpose": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
        "code": "TREAT",
        "display": "Treatment"
      }
    ]
  }
}
```

### 6.3 Revogacao de Consentimento

O paciente pode revogar consentimento para categorias opcionais a qualquer momento:
- Revogacao e registrada como novo recurso `Consent` com `status: inactive`.
- Acesso ja realizado permanece na trilha de auditoria.
- Profissionais ativos no CareTeam sao notificados da restricao.
- Acesso assistencial direto NAO pode ser completamente revogado durante internacao ativa (requisito legal de seguranca do paciente).

---

## 7. Break-Glass: Acesso Emergencial Auditado

### 7.1 Quando se Aplica

Break-glass e ativado quando um profissional precisa acessar a timeline de um paciente com quem NAO tem vinculo ativo (nao e CareTeam member, nao tem interconsulta, nao e supervisor da unidade), em situacao de emergencia clinica.

### 7.2 Fluxo

```
┌──────────────────┐
│ Profissional     │
│ tenta acessar    │
│ timeline sem     │
│ vinculo          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐    NAO     ┌──────────────────┐
│ Acesso normal    │◄──────────│ Tem vinculo com   │
│ negado.          │            │ o encontro?       │
│ Opcao: Break     │            └──────────────────┘
│ Glass?           │
└────────┬─────────┘
         │ SIM (break-glass)
         ▼
┌──────────────────┐
│ Formulario:      │
│ - Justificativa  │
│   (obrigatoria)  │
│ - Motivo clinico │
│   (dropdown)     │
│ - Confirmacao    │
│   de ciencia de  │
│   auditoria      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Acesso concedido │
│ - Limite: 2h     │
│ - Escopo: view   │
│   only (sem      │
│   edicao)        │
│ - Notificacao    │
│   automatica:    │
│   - DPO          │
│   - Coordenador  │
│   - Medico resp. │
│ - Revisao obri-  │
│   gatoria em 24h │
└──────────────────┘
```

### 7.3 Justificativas Validas

| Codigo | Justificativa | Limite de Tempo |
|---|---|---|
| `BG-EMER` | Emergencia clinica (PCR, deterioracao aguda) | 2h |
| `BG-TRANS` | Transferencia em andamento, CareTeam ainda nao atualizado | 1h |
| `BG-COB` | Cobertura de plantao nao registrada no sistema | Ate fim do turno |
| `BG-CONSUL` | Interconsulta verbal, ainda nao formalizada | 2h |
| `BG-SEG` | Risco de seguranca do paciente iminente | 2h |

### 7.4 Revisao Pos-Evento

Toda ativacao de break-glass requer revisao em 24 horas:
- Coordenador da unidade confirma se a justificativa era valida.
- Se invalida: registro de uso indevido, encaminhamento para comissao de etica.
- Se valida: regularizacao do vinculo (se necessario) e arquivamento.
- Relatorio mensal de break-glass para DPO e diretoria.

---

## 8. Logs Imutaveis

### 8.1 Requisitos de Imutabilidade

| Requisito | Implementacao |
|---|---|
| **Append-only** | AuditEvents sao inseridos, nunca atualizados ou deletados |
| **Assinatura digital** | Cada AuditEvent recebe hash SHA-256 + assinatura do servico |
| **Encadeamento** | Hash do evento anterior e incluido no proximo (blockchain-like) |
| **Redundancia** | Replicacao sincrona para 3 nos minimo |
| **Protecao contra admin** | DBA nao tem permissao de DELETE na tabela de audit |
| **Verificacao periodica** | Job diario verifica integridade da cadeia de hashes |

### 8.2 Schema de Armazenamento

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number BIGSERIAL NOT NULL,
  previous_hash VARCHAR(64) NOT NULL,
  event_hash VARCHAR(64) NOT NULL,
  
  -- FHIR AuditEvent fields
  event_type VARCHAR(50) NOT NULL,
  event_subtype VARCHAR(50),
  action CHAR(1) NOT NULL, -- C, R, U, D
  recorded TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome SMALLINT NOT NULL, -- 0=success, 4=minor, 8=serious, 12=major
  
  -- Agent
  agent_who_reference VARCHAR(200) NOT NULL,
  agent_who_display VARCHAR(200),
  agent_role VARCHAR(50),
  agent_requestor BOOLEAN NOT NULL,
  agent_network_address INET,
  agent_device_id VARCHAR(100),
  agent_purpose_of_use VARCHAR(50),
  
  -- Entity (patient)
  entity_patient_reference VARCHAR(200),
  entity_encounter_reference VARCHAR(200),
  entity_resource_reference VARCHAR(200),
  entity_resource_type VARCHAR(50),
  
  -- Details
  detail JSONB,
  
  -- Immutability
  service_signature VARCHAR(512) NOT NULL,
  
  -- Constraints
  CONSTRAINT audit_sequence_unique UNIQUE (sequence_number),
  CONSTRAINT audit_hash_unique UNIQUE (event_hash)
);

-- Sem permissao de UPDATE ou DELETE para qualquer role
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_events FROM velya_app;
REVOKE UPDATE, DELETE ON audit_events FROM velya_admin;
-- Apenas o owner da tabela (superuser controlado) poderia, mas procedimento operacional proibe
```

### 8.3 Verificacao de Integridade

```sql
-- Job diario de verificacao
WITH ordered_events AS (
  SELECT id, sequence_number, previous_hash, event_hash,
         LAG(event_hash) OVER (ORDER BY sequence_number) AS expected_previous_hash
  FROM audit_events
)
SELECT id, sequence_number
FROM ordered_events
WHERE previous_hash != expected_previous_hash
  AND sequence_number > 1;
-- Resultado esperado: 0 linhas. Qualquer linha indica violacao.
```

---

## 9. Exportacao Controlada

### 9.1 Tipos de Exportacao

| Tipo | Formato | Quem Pode | Autorizacao |
|---|---|---|---|
| **Timeline PDF** | PDF assinado digitalmente | Medico responsavel | Automatica (CareTeam member) |
| **Relatorio de alta** | PDF | Medico responsavel | Automatica |
| **Timeline para paciente** | PDF simplificado | Medico responsavel | Com consentimento |
| **Exportacao para pesquisa** | CSV anonimizado | Pesquisador autorizado | CEP + DPO |
| **Exportacao para outro hospital** | FHIR Bundle | Medico responsavel | Consentimento do paciente |
| **Exportacao para seguros** | PDF parcial | Medico responsavel | Consentimento + autorizacao DPO |
| **Portabilidade (LGPD)** | FHIR Bundle ou PDF | Paciente (via DPO) | Solicitacao formal |

### 9.2 Controles de Exportacao

1. **Marca d'agua**: Todo PDF exportado contem marca d'agua com nome do solicitante, data/hora e numero de rastreamento.
2. **Trilha**: Toda exportacao gera `AuditEvent` com detalhes do conteudo exportado.
3. **Escopo**: Exportacao e filtrada pelo papel do solicitante (mesmo mascaramento da visualizacao).
4. **Limite de volume**: Maximo de 100 pacientes por exportacao (exceto pesquisa com aprovacao CEP).
5. **Validade**: Links de download expiram em 24 horas.
6. **Criptografia**: Exportacoes sao criptografadas em transito (TLS) e em repouso (AES-256).

### 9.3 Fluxo de Exportacao

```
Solicitacao -> Verificacao de autorizacao -> Aplicacao de mascaramento ->
Geracao do arquivo -> Assinatura digital -> Registro de AuditEvent ->
Disponibilizacao com link temporario -> Notificacao ao DPO (se sensivel)
```

---

## 10. Mascaramento por Papel

### 10.1 Tipos de Mascaramento

| Tipo | Descricao | Exemplo |
|---|---|---|
| **Redact** | Campo completamente removido | Diagnostico psiquiatrico removido para farmaceutico |
| **Generalize** | Campo generalizado | Idade "34 anos" em vez de data de nascimento |
| **Pseudonymize** | Identificador substituido | "Paciente A" em vez de nome real |
| **Truncate** | Informacao parcial | CPF: ***.456.***-** |
| **Aggregate** | Dados agrupados | "3 medicamentos prescritos" em vez da lista |
| **Delay** | Acesso somente apos periodo | Resultado de HIV visivel somente apos aconselhamento |

### 10.2 Regras de Mascaramento por Campo

| Campo | Medico Resp. | Enfermeiro | Tec. Enferm. | Farmaceutico | Admin | Pesquisador |
|---|---|---|---|---|---|---|
| Nome completo | Visivel | Visivel | Visivel | Visivel | Visivel | Pseudonymizado |
| CPF | Visivel | Truncado | Oculto | Oculto | Visivel | Oculto |
| Endereco | Visivel | Cidade | Oculto | Oculto | Visivel | Oculto |
| Telefone | Visivel | Visivel | Oculto | Oculto | Visivel | Oculto |
| Data nascimento | Visivel | Visivel | Visivel | Visivel | Visivel | Generalizado (idade) |
| Diagnostico principal | Visivel | Visivel | Resumo | Resumo | CID | CID anonimizado |
| Diagnostico psiq. | Se psiquiatra | Oculto | Oculto | Oculto | Oculto | Oculto |
| HIV/IST | Visivel | Visivel | Oculto | Oculto | Oculto | Oculto |
| Historico social | Visivel | Resumo | Oculto | Oculto | Oculto | Oculto |
| Valores de exames | Visivel | Visivel | Oculto | Relevantes | Oculto | Anonimizado |
| Custos/faturamento | Oculto | Oculto | Oculto | Oculto | Visivel | Oculto |

### 10.3 Dados Especialmente Protegidos

Categorias de dados que recebem protecao adicional (LGPD Art. 11):

| Categoria | Protecao Adicional |
|---|---|
| **Saude mental/psiquiatria** | Somente profissional de saude mental com vinculo, break-glass nao exibe |
| **HIV/AIDS** | Lei 14.289/2022 — sigilo reforçado, acesso restrito |
| **Genetica** | Somente geneticista com vinculo, nao exportavel para pesquisa sem CEP |
| **Uso de substancias** | Somente equipe de tratamento, nao visivel em emergencia por padrao |
| **Violencia/abuso** | Somente assistente social e medico responsavel |
| **Reprodutivo** | Somente obstetra/ginecologista com vinculo |

---

## 11. Monitoramento e Alertas de Seguranca

### 11.1 Alertas Automaticos

| Evento | Alerta Para | Prazo |
|---|---|---|
| Break-glass ativado | DPO + Coordenador + Medico responsavel | Imediato |
| Acesso fora do horario de turno | Coordenador | Proximo dia util |
| Volume anormal de acessos (> 20 pacientes/hora) | DPO | Imediato |
| Acesso ao proprio prontuario | DPO | Imediato |
| Acesso a prontuario de familiar | DPO | Imediato |
| Acesso a prontuario VIP | DPO + Diretoria | Imediato |
| Exportacao de dados | DPO | Diario (consolidado) |
| Multiplas tentativas negadas | DPO + TI | Imediato |
| Acesso de usuario desligado | TI + DPO | Imediato |

### 11.2 Metricas de Seguranca (PromQL)

```promql
# Break-glass ativados por dia
sum(increase(velya_break_glass_activated_total[24h]))

# Acessos negados por motivo
sum by (reason) (increase(velya_timeline_access_denied_total[24h]))

# Volume de acesso por profissional (deteccao de anomalia)
topk(10, sum by (practitioner) (increase(velya_timeline_access_total[1h])))

# Exportacoes realizadas
sum(increase(velya_timeline_export_total[24h]))

# Tempo medio de sessao na timeline
histogram_quantile(0.50, rate(velya_timeline_session_duration_seconds_bucket[24h]))
```

---

## 12. Compliance e Regulatorio

### 12.1 Mapeamento Regulatorio

| Requisito | Regulamento | Como Atendemos |
|---|---|---|
| Minimizacao de dados | LGPD Art. 6, III | Mascaramento por papel, views segmentadas |
| Base legal para tratamento | LGPD Art. 7/11 | Consentimento + tutela da saude |
| Trilha de auditoria | LGPD Art. 37 | AuditEvents imutaveis |
| Direito de acesso | LGPD Art. 18, II | Portabilidade via FHIR Bundle |
| Seguranca | LGPD Art. 46 | RBAC+ABAC, criptografia, logs imutaveis |
| DPO | LGPD Art. 41 | Notificacoes automaticas para DPO |
| Registro de atividades | LGPD Art. 37 | AuditEvent completo |
| Prontuario eletronico | CFM 1821/2007 | Assinatura digital, integridade |
| Tempo de guarda | CFM 1821/2007 | 20 anos minimo |
| Sigilo profissional | CEM Art. 73-79 | Controle de acesso por vinculo |
