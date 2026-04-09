# Estrategia de Provenance e AuditEvent FHIR — Velya Platform

> Uso de Provenance para autoria/origem/integridade/confianca, AuditEvent para acesso/leitura/escrita/exportacao/auth, Task para responsabilidade/execucao, Communication para acionamentos/retornos, CareTeam para contexto assistencial, Encounter para contexto de atendimento.

---

## 1. Principio Fundamental

**Nada critico acontece sem Provenance + AuditEvent. Cada acao que muda estado clinico ou operacional gera rastreabilidade FHIR completa.**

---

## 2. Mapeamento de Recursos FHIR

### 2.1 Visao Geral

| Recurso FHIR | Proposito no Velya | Quando Criar |
|---|---|---|
| **Provenance** | Autoria, origem, integridade, confianca | Toda criacao/edicao de dado clinico ou operacional |
| **AuditEvent** | Acesso, leitura, escrita, exportacao, autenticacao | Toda acao de acesso, sessao, operacao |
| **Task** | Responsabilidade, execucao, delegacao | Toda atividade com responsavel e prazo |
| **Communication** | Acionamentos, retornos, notificacoes | Todo acionamento, comunicacao critica, alerta |
| **CareTeam** | Contexto da equipe assistencial | Todo paciente internado/em atendimento |
| **Encounter** | Contexto do encontro/atendimento | Todo atendimento (PA, internacao, ambulatorio) |

### 2.2 Relacao entre Recursos

```
                    [Encounter]
                        |
              +---------+---------+
              |                   |
          [CareTeam]          [Patient]
              |                   |
              v                   v
    +----[Provenance]----+   [Task]
    |         |          |     |
    v         v          v     v
[Observation] [MedicationAdmin] [Communication]
    |              |               |
    v              v               v
[AuditEvent] [AuditEvent]   [AuditEvent]
```

---

## 3. Provenance — Autoria e Origem

### 3.1 Quando Criar Provenance

| Acao | Provenance Obrigatoria | Target |
|---|---|---|
| Evolucao medica/enfermagem | Sim | DocumentReference, Composition |
| Prescricao | Sim | MedicationRequest |
| Administracao medicamento | Sim | MedicationAdministration |
| Resultado exame | Sim | DiagnosticReport, Observation |
| Procedimento | Sim | Procedure |
| Parecer/Interconsulta | Sim | DocumentReference |
| Alta medica | Sim | Encounter (update) |
| Registro operacional (limpeza, transporte, etc) | Sim | Task |
| Correcao de registro | Sim | Recurso corrigido |
| Cancelamento | Sim | Recurso cancelado |

### 3.2 Exemplo: Provenance de Evolucao Medica

```json
{
  "resourceType": "Provenance",
  "id": "prov-evol-2026-04-08-001",
  "target": [{
    "reference": "Composition/evol-med-2026-04-08-001"
  }],
  "occurredDateTime": "2026-04-08T08:30:00-03:00",
  "recorded": "2026-04-08T08:32:15-03:00",
  "policy": [
    "https://velya.health/policy/clinical-authorship-v1"
  ],
  "activity": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion",
      "code": "AU",
      "display": "authenticated"
    }]
  },
  "agent": [
    {
      "type": {
        "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
          "code": "author",
          "display": "Author"
        }]
      },
      "who": {
        "reference": "Practitioner/med-carlos-oliveira",
        "display": "Dr. Carlos Oliveira - CRM 12345/SP"
      },
      "onBehalfOf": {
        "reference": "Organization/hospital-velya"
      }
    },
    {
      "type": {
        "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
          "code": "enterer",
          "display": "Enterer"
        }]
      },
      "who": {
        "reference": "Practitioner/med-carlos-oliveira"
      }
    }
  ],
  "entity": [{
    "role": "source",
    "what": {
      "reference": "Encounter/enc-2026-04-08-001"
    }
  }],
  "signature": [{
    "type": [{
      "system": "urn:iso-astm:E1762-95:2013",
      "code": "1.2.840.10065.1.12.1.1",
      "display": "Author's Signature"
    }],
    "when": "2026-04-08T08:32:15-03:00",
    "who": {
      "reference": "Practitioner/med-carlos-oliveira"
    },
    "sigFormat": "application/jose",
    "data": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }]
}
```

### 3.3 Exemplo: Provenance de Correcao

```json
{
  "resourceType": "Provenance",
  "id": "prov-correcao-2026-04-08-001",
  "target": [{
    "reference": "Composition/evol-med-2026-04-07-005"
  }],
  "occurredDateTime": "2026-04-08T10:00:00-03:00",
  "recorded": "2026-04-08T10:00:45-03:00",
  "reason": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
      "code": "TREAT",
      "display": "treatment"
    }],
    "text": "Correcao de dosagem registrada incorretamente na evolucao do dia anterior"
  }],
  "activity": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
      "code": "UPDATE",
      "display": "revise"
    }]
  },
  "agent": [{
    "type": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
        "code": "author"
      }]
    },
    "who": {
      "reference": "Practitioner/med-carlos-oliveira"
    }
  }],
  "entity": [{
    "role": "revision",
    "what": {
      "reference": "Composition/evol-med-2026-04-07-005/_history/1"
    }
  }]
}
```

---

## 4. AuditEvent — Acesso e Operacoes

### 4.1 Quando Criar AuditEvent

| Acao | AuditEvent Obrigatoria | Type |
|---|---|---|
| Login/Logout | Sim | UserAuthentication |
| Acesso a prontuario | Sim | Query |
| Leitura de dado clinico | Sim | Read |
| Criacao de registro | Sim | Create |
| Edicao de registro | Sim | Update |
| Exclusao/cancelamento | Sim | Delete |
| Exportacao de dados | Sim | Export |
| Impressao | Sim | Print |
| Break-glass | Sim | EmergencyAccess |
| Troca de usuario | Sim | UserAuthentication |
| Falha de autenticacao | Sim | UserAuthentication |
| Visualizacao de dado sensivel | Sim | Read |
| Busca de paciente | Sim | Query |

### 4.2 Exemplo: Acesso a Prontuario

```json
{
  "resourceType": "AuditEvent",
  "id": "audit-acesso-2026-04-08-001",
  "type": {
    "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
    "code": "rest",
    "display": "RESTful Operation"
  },
  "subtype": [{
    "system": "http://hl7.org/fhir/restful-interaction",
    "code": "read",
    "display": "read"
  }],
  "action": "R",
  "period": {
    "start": "2026-04-08T09:15:00-03:00",
    "end": "2026-04-08T09:15:02-03:00"
  },
  "recorded": "2026-04-08T09:15:02-03:00",
  "outcome": "0",
  "agent": [{
    "type": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/extra-security-role-type",
        "code": "humanuser"
      }]
    },
    "who": {
      "reference": "Practitioner/enf-maria-silva",
      "display": "Maria Silva - Enfermeira"
    },
    "requestor": true,
    "network": {
      "address": "10.0.5.42",
      "type": "2"
    }
  }],
  "source": {
    "site": "UTI-Adulto",
    "observer": {
      "reference": "Device/velya-api-gateway"
    },
    "type": [{
      "system": "http://terminology.hl7.org/CodeSystem/security-source-type",
      "code": "4",
      "display": "Application Server"
    }]
  },
  "entity": [
    {
      "what": {
        "reference": "Patient/pac-12345"
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
      }
    },
    {
      "what": {
        "reference": "Encounter/enc-2026-04-08-001"
      },
      "type": {
        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
        "code": "2",
        "display": "System Object"
      }
    }
  ]
}
```

### 4.3 Exemplo: Break-Glass

```json
{
  "resourceType": "AuditEvent",
  "id": "audit-breakglass-2026-04-08-001",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110113",
    "display": "Security Alert"
  },
  "subtype": [{
    "system": "https://velya.health/fhir/CodeSystem/audit-subtype",
    "code": "break-glass",
    "display": "Emergency Access Override"
  }],
  "action": "E",
  "recorded": "2026-04-08T14:30:00-03:00",
  "outcome": "0",
  "outcomeDesc": "Break-glass concedido para acesso emergencial",
  "purposeOfEvent": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
      "code": "ETREAT",
      "display": "Emergency Treatment"
    }],
    "text": "Paciente em PCR, necessidade de acesso imediato ao historico de alergias"
  }],
  "agent": [{
    "type": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/extra-security-role-type",
        "code": "humanuser"
      }]
    },
    "who": {
      "reference": "Practitioner/med-ana-costa",
      "display": "Dra. Ana Costa - Medica Plantonista"
    },
    "requestor": true,
    "policy": [
      "https://velya.health/policy/break-glass-v1"
    ]
  }],
  "source": {
    "site": "PA-Adulto",
    "observer": {
      "reference": "Device/velya-api-gateway"
    }
  },
  "entity": [{
    "what": {
      "reference": "Patient/pac-67890"
    },
    "type": {
      "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
      "code": "1",
      "display": "Person"
    },
    "detail": [{
      "type": "justification",
      "valueString": "PCR - acesso emergencial a historico de alergias"
    }, {
      "type": "expiry",
      "valueString": "2026-04-08T15:30:00-03:00"
    }]
  }]
}
```

---

## 5. Task — Responsabilidade e Execucao

### 5.1 Exemplo: Tarefa de Limpeza Terminal

```json
{
  "resourceType": "Task",
  "id": "task-limpeza-2026-04-08-001",
  "status": "in-progress",
  "businessStatus": {
    "coding": [{
      "system": "https://velya.health/fhir/CodeSystem/task-business-status",
      "code": "em_execucao",
      "display": "Em Execucao"
    }]
  },
  "intent": "order",
  "priority": "urgent",
  "code": {
    "coding": [{
      "system": "https://velya.health/fhir/CodeSystem/work-event-type",
      "code": "limpeza_terminal",
      "display": "Limpeza Terminal"
    }]
  },
  "description": "Limpeza terminal do leito 201-B apos alta",
  "for": {
    "reference": "Location/leito-201-ala-b"
  },
  "encounter": {
    "reference": "Encounter/enc-2026-04-07-042"
  },
  "authoredOn": "2026-04-08T11:00:00-03:00",
  "lastModified": "2026-04-08T11:15:00-03:00",
  "requester": {
    "reference": "Practitioner/enf-maria-silva"
  },
  "owner": {
    "reference": "Practitioner/hig-joao-santos"
  },
  "restriction": {
    "period": {
      "end": "2026-04-08T12:00:00-03:00"
    }
  },
  "input": [
    {
      "type": { "text": "tipo_limpeza" },
      "valueString": "terminal"
    },
    {
      "type": { "text": "motivo" },
      "valueString": "alta"
    },
    {
      "type": { "text": "isolamento" },
      "valueBoolean": false
    },
    {
      "type": { "text": "sla_target_minutes" },
      "valueInteger": 60
    }
  ],
  "output": [
    {
      "type": { "text": "tempo_resposta_minutos" },
      "valueInteger": 12
    },
    {
      "type": { "text": "profissional_chegou_em" },
      "valueDateTime": "2026-04-08T11:12:00-03:00"
    }
  ]
}
```

---

## 6. Communication — Acionamentos e Retornos

### 6.1 Exemplo: Comunicacao de Valor Critico

```json
{
  "resourceType": "Communication",
  "id": "comm-valor-critico-2026-04-08-001",
  "status": "completed",
  "category": [{
    "coding": [{
      "system": "https://velya.health/fhir/CodeSystem/communication-category",
      "code": "critical-value",
      "display": "Valor Critico"
    }]
  }],
  "priority": "urgent",
  "subject": {
    "reference": "Patient/pac-12345"
  },
  "encounter": {
    "reference": "Encounter/enc-2026-04-08-001"
  },
  "sent": "2026-04-08T10:45:00-03:00",
  "received": "2026-04-08T10:47:30-03:00",
  "sender": {
    "reference": "Practitioner/lab-pedro-costa",
    "display": "Pedro Costa - Biomedico"
  },
  "recipient": [{
    "reference": "Practitioner/med-carlos-oliveira",
    "display": "Dr. Carlos Oliveira"
  }],
  "payload": [
    {
      "contentString": "Potassio: 7.2 mEq/L (Ref: 3.5-5.0). Valor critico confirmado em segunda dosagem."
    }
  ],
  "extension": [{
    "url": "https://velya.health/fhir/StructureDefinition/closed-loop-confirmation",
    "extension": [
      {
        "url": "readback",
        "valueString": "Potassio 7.2 confirmado"
      },
      {
        "url": "confirmed_at",
        "valueDateTime": "2026-04-08T10:48:00-03:00"
      },
      {
        "url": "confirmed_by",
        "valueReference": {
          "reference": "Practitioner/med-carlos-oliveira"
        }
      }
    ]
  }]
}
```

---

## 7. CareTeam — Contexto Assistencial

### 7.1 Exemplo: Equipe de Cuidado UTI

```json
{
  "resourceType": "CareTeam",
  "id": "careteam-uti-turno-d-2026-04-08",
  "status": "active",
  "category": [{
    "coding": [{
      "system": "http://loinc.org",
      "code": "LA27976-2",
      "display": "Encounter-focused care team"
    }]
  }],
  "name": "Equipe UTI Adulto - Diurno 08/04/2026",
  "subject": {
    "reference": "Patient/pac-12345"
  },
  "encounter": {
    "reference": "Encounter/enc-2026-04-08-001"
  },
  "period": {
    "start": "2026-04-08T07:00:00-03:00",
    "end": "2026-04-08T19:00:00-03:00"
  },
  "participant": [
    {
      "role": [{
        "coding": [{
          "system": "http://snomed.info/sct",
          "code": "309343006",
          "display": "Physician"
        }]
      }],
      "member": {
        "reference": "Practitioner/med-carlos-oliveira",
        "display": "Dr. Carlos Oliveira"
      },
      "period": {
        "start": "2026-04-08T07:00:00-03:00",
        "end": "2026-04-08T19:00:00-03:00"
      }
    },
    {
      "role": [{
        "coding": [{
          "system": "http://snomed.info/sct",
          "code": "224535009",
          "display": "Registered Nurse"
        }]
      }],
      "member": {
        "reference": "Practitioner/enf-maria-silva",
        "display": "Enf. Maria Silva"
      },
      "period": {
        "start": "2026-04-08T07:00:00-03:00",
        "end": "2026-04-08T19:00:00-03:00"
      }
    },
    {
      "role": [{
        "coding": [{
          "system": "http://snomed.info/sct",
          "code": "36682004",
          "display": "Physiotherapist"
        }]
      }],
      "member": {
        "reference": "Practitioner/fisio-ana-lima",
        "display": "Fisio. Ana Lima"
      },
      "period": {
        "start": "2026-04-08T08:00:00-03:00",
        "end": "2026-04-08T17:00:00-03:00"
      }
    }
  ]
}
```

---

## 8. Pipeline de Geracao Automatica

### 8.1 Temporal Workflow

```typescript
interface ProvenanceAuditWorkflow {
  name: 'provenance-audit-generation';
  taskQueue: 'fhir-provenance';

  triggers: [
    'velya.work.>',                     // Qualquer evento de trabalho
    'velya.session.>',                   // Qualquer evento de sessao
    'velya.handoff.>',                   // Qualquer evento de handoff
  ];

  activities: {
    determineResources: {
      description: 'Decide quais recursos FHIR criar (Provenance, AuditEvent, ambos)';
      input: { event: WorkEvent | SessionEvent | HandoffEvent };
      output: { resources_to_create: ('Provenance' | 'AuditEvent' | 'Task' | 'Communication')[] };
    };
    createProvenance: {
      description: 'Cria Provenance FHIR';
      input: { event: unknown; target: string };
      output: { provenance_id: string };
    };
    createAuditEvent: {
      description: 'Cria AuditEvent FHIR';
      input: { event: unknown };
      output: { audit_event_id: string };
    };
    updateTask: {
      description: 'Atualiza Task FHIR (se aplicavel)';
      input: { event: unknown; task_id?: string };
      output: { task_id: string };
    };
    linkResources: {
      description: 'Vincula Provenance ao WorkEvent e AuditEvent';
      input: { event_id: string; provenance_id: string; audit_event_id: string };
      output: void;
    };
  };
}
```

### 8.2 Regras de Geracao

| Tipo de Evento | Provenance | AuditEvent | Task | Communication |
|---|---|---|---|---|
| Evolucao clinica | Sim | Sim | Nao | Nao |
| Prescricao | Sim | Sim | Nao | Nao |
| Administracao medicamento | Sim | Sim | Nao | Nao |
| Limpeza terminal | Sim | Sim | Sim | Nao |
| Transporte paciente | Sim | Sim | Sim | Nao |
| Comunicacao valor critico | Sim | Sim | Nao | Sim |
| Login/Logout | Nao | Sim | Nao | Nao |
| Acesso prontuario | Nao | Sim | Nao | Nao |
| Break-glass | Sim | Sim | Nao | Sim |
| Handoff | Sim | Sim | Sim | Sim |
| Correcao registro | Sim | Sim | Nao | Nao |
| Interconsulta | Sim | Sim | Sim | Sim |

---

## 9. Retencao e Armazenamento

```yaml
retention:
  provenance:
    hot_storage: "5y"           # 5 anos em PostgreSQL/FHIR Server
    cold_storage: "20y"         # 20 anos em object storage (LGPD saude)
    format: "FHIR JSON + assinatura"

  audit_event:
    hot_storage: "2y"           # 2 anos em PostgreSQL
    cold_storage: "20y"         # 20 anos em object storage
    format: "FHIR JSON comprimido"

  task:
    hot_storage: "1y"           # 1 ano (tarefas operacionais)
    cold_storage: "5y"
    format: "FHIR JSON"

  communication:
    hot_storage: "1y"
    cold_storage: "20y"         # Comunicacoes clinicas retidas por 20 anos
    format: "FHIR JSON"
```

---

## 10. Resumo

A estrategia de Provenance e AuditEvent garante:

1. **Provenance para autoria** — Quem fez, quando, por que, com qual autoridade.
2. **AuditEvent para acesso** — Quem acessou, o que viu, de onde, quando.
3. **Task para execucao** — Responsabilidade, prazo, status, delegacao.
4. **Communication para acionamentos** — Closed loop, valor critico, interconsulta.
5. **CareTeam para contexto** — Quem cuida de quem, em qual turno.
6. **Geracao automatica** — Workflow Temporal gera recursos FHIR a cada evento.
7. **Retencao conforme LGPD** — Hot + cold storage por ate 20 anos.
8. **Assinatura digital** — Provenance com assinatura ICP-Brasil para registros clinicos.
