# Estrategia FHIR: Task, Communication, Provenance e Recursos Correlatos

> Como os recursos FHIR Task, Communication, CareTeam, Encounter, Provenance e AuditEvent se interconectam para sustentar o modelo de accountability da Velya.

## 1. Visao Geral

O modelo de dados da Velya utiliza recursos FHIR R4 como unidade fundamental de representacao. Seis recursos formam o nucleo da estrategia de rastreabilidade:

| Recurso FHIR      | Papel na Velya                                            |
| ----------------- | --------------------------------------------------------- |
| **Task**          | Atribuicao, execucao e conclusao de trabalho              |
| **Communication** | Acionamentos, retornos e notificacoes entre profissionais |
| **CareTeam**      | Contexto de equipe — quem cuida de quem                   |
| **Encounter**     | Contexto do encontro — internacao, consulta, emergencia   |
| **Provenance**    | Autoria e integridade — quem criou/alterou cada recurso   |
| **AuditEvent**    | Trilha de acesso — quem acessou o que e quando            |

### 1.1 Diagrama de Interconexao

```
                         ┌──────────────┐
                         │   Encounter  │
                         │  (contexto)  │
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ CareTeam │ │   Task   │ │Communication│
             │ (equipe) │ │(trabalho)│ │(mensagens)  │
             └────┬─────┘ └────┬─────┘ └─────┬──────┘
                  │            │              │
                  │      ┌─────┴─────┐        │
                  │      │           │        │
                  ▼      ▼           ▼        ▼
             ┌──────────────┐  ┌──────────────┐
             │  Provenance  │  │  AuditEvent  │
             │  (autoria)   │  │  (acesso)    │
             └──────────────┘  └──────────────┘
```

---

## 2. Task: Atribuicao, Execucao e Conclusao

### 2.1 Conceito

O recurso `Task` representa uma unidade de trabalho atribuivel. Na Velya, toda acao que pode ser delegada, rastreada e concluida e modelada como Task.

### 2.2 Ciclo de Vida

```
draft → requested → received → accepted → in-progress → completed
                                  │                          │
                                  ├→ rejected                │
                                  │                          │
                                  └→ on-hold → in-progress   │
                                                             │
                                              failed ←───────┘
                                              cancelled ←────┘
```

### 2.3 Tipos de Task na Velya

| Tipo               | Descricao                         | Exemplo                 |
| ------------------ | --------------------------------- | ----------------------- |
| `handoff`          | Transferencia de responsabilidade | Handoff de turno        |
| `medication-admin` | Administracao de medicamento      | Aplicar insulina        |
| `assessment`       | Avaliacao/registro                | Sinais vitais, dor      |
| `procedure`        | Procedimento                      | Troca de curativo       |
| `lab-collection`   | Coleta de exame                   | Coleta de sangue        |
| `documentation`    | Documentacao                      | Evolucao de enfermagem  |
| `signature`        | Assinatura digital                | Assinar evolucao medica |
| `consultation`     | Interconsulta                     | Avaliacao cardiologica  |
| `discharge-step`   | Etapa de alta                     | Orientacao de alta      |
| `transport`        | Transporte do paciente            | Levar ao RX             |
| `notification`     | Notificacao acionavel             | Resultado critico       |

### 2.4 Exemplo FHIR: Task de Administracao de Medicamento

```json
{
  "resourceType": "Task",
  "id": "task-med-admin-001",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2026-04-09T14:00:00Z",
    "profile": ["http://velya.health/StructureDefinition/VelyaTask"]
  },
  "identifier": [
    {
      "system": "http://velya.health/task-id",
      "value": "TASK-20260409-140000-MED-001"
    }
  ],
  "status": "in-progress",
  "statusReason": {
    "text": "Enfermeira iniciou preparo da medicacao"
  },
  "intent": "order",
  "priority": "urgent",
  "code": {
    "coding": [
      {
        "system": "http://velya.health/task-type",
        "code": "medication-admin",
        "display": "Administracao de Medicamento"
      }
    ]
  },
  "description": "Administrar Ceftriaxona 1g IV agora",
  "focus": {
    "reference": "MedicationRequest/mr-ceftriaxona-001",
    "display": "Ceftriaxona 1g IV 12/12h"
  },
  "for": {
    "reference": "Patient/pat-12345",
    "display": "Maria Santos"
  },
  "encounter": {
    "reference": "Encounter/enc-789",
    "display": "Internacao UTI-A - Maria Santos"
  },
  "authoredOn": "2026-04-09T14:00:00Z",
  "lastModified": "2026-04-09T14:05:00Z",
  "requester": {
    "reference": "Practitioner/dr-silva",
    "display": "Dra. Ana Silva - CRM 12345/SP"
  },
  "owner": {
    "reference": "Practitioner/enf-maria",
    "display": "Enf. Maria Costa - COREN 123456/SP"
  },
  "location": {
    "reference": "Location/uti-a-leito-3",
    "display": "UTI-A, Leito 3"
  },
  "restriction": {
    "period": {
      "start": "2026-04-09T14:00:00Z",
      "end": "2026-04-09T15:00:00Z"
    }
  },
  "input": [
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "medication-details"
          }
        ]
      },
      "valueString": "Ceftriaxona 1g diluida em 100ml SF 0,9% IV em 30 min"
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "double-check-required"
          }
        ]
      },
      "valueBoolean": false
    }
  ],
  "output": [],
  "note": [
    {
      "authorReference": {
        "reference": "Practitioner/enf-maria"
      },
      "time": "2026-04-09T14:05:00Z",
      "text": "Iniciando preparo. Verificando alergias - sem alergias registradas."
    }
  ]
}
```

### 2.5 Exemplo FHIR: Task de Handoff

```json
{
  "resourceType": "Task",
  "id": "task-handoff-002",
  "status": "requested",
  "intent": "order",
  "priority": "urgent",
  "code": {
    "coding": [
      {
        "system": "http://velya.health/task-type",
        "code": "handoff",
        "display": "Transferencia de Responsabilidade"
      }
    ]
  },
  "description": "Handoff de turno diurno para noturno - Leito 3",
  "for": {
    "reference": "Patient/pat-12345",
    "display": "Maria Santos"
  },
  "encounter": {
    "reference": "Encounter/enc-789"
  },
  "authoredOn": "2026-04-09T18:45:00Z",
  "requester": {
    "reference": "Practitioner/enf-carlos",
    "display": "Enf. Carlos Lima - COREN 654321/SP"
  },
  "owner": {
    "reference": "Practitioner/enf-joana",
    "display": "Enf. Joana Pereira - COREN 987654/SP"
  },
  "restriction": {
    "period": {
      "end": "2026-04-09T19:00:00Z"
    }
  },
  "input": [
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "handoff-format"
          }
        ]
      },
      "valueString": "ipass"
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "illness-severity"
          }
        ]
      },
      "valueString": "Em observacao - NEWS2 = 4"
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "patient-summary"
          }
        ]
      },
      "valueString": "Pos-op D1 de colecistectomia videolaparoscopica. Evoluiu bem no turno. Aceitando dieta liquida. Dor controlada (NRS 3) com dipirona. Dreno com debito seroso 50ml no turno."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "action-list"
          }
        ]
      },
      "valueString": "[\"Administrar Ceftriaxona 1g IV as 20h\",\"Reavaliar dor as 22h\",\"Registrar debito do dreno as 00h\",\"Sinais vitais 4/4h\"]"
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/task-input-type",
            "code": "situation-awareness"
          }
        ]
      },
      "valueString": "Observar sinais de sangramento pelo dreno. Se debito > 100ml/h ou hemático, acionar cirurgiao (Dr. Oliveira - ramal 4567). Monitorar aceitacao da dieta."
    }
  ]
}
```

---

## 3. Communication: Acionamentos e Retornos

### 3.1 Conceito

O recurso `Communication` registra toda troca de informacao entre profissionais. Diferente do `Task` (que representa trabalho a fazer), `Communication` representa **informacao transmitida**.

### 3.2 Tipos de Communication na Velya

| Tipo                           | Descricao                        | Exemplo                                  |
| ------------------------------ | -------------------------------- | ---------------------------------------- |
| `critical-result-notification` | Comunicacao de resultado critico | Lab comunica K+ = 6.8 ao medico          |
| `clinical-escalation`          | Escalacao clinica (SBAR)         | Enfermeiro escala deterioracao ao medico |
| `order-clarification`          | Esclarecimento de prescricao     | Farmaceutico questiona dose              |
| `care-coordination`            | Coordenacao de cuidado           | Nutricionista informa troca de dieta     |
| `family-communication`         | Comunicacao com familiar         | Medico informa boletim                   |
| `discharge-instruction`        | Orientacao de alta               | Instrucoes para o paciente               |
| `safety-alert`                 | Alerta de seguranca              | Sistema detecta interacao medicamentosa  |

### 3.3 Exemplo FHIR: Comunicacao de Resultado Critico

```json
{
  "resourceType": "Communication",
  "id": "comm-critical-001",
  "status": "completed",
  "category": [
    {
      "coding": [
        {
          "system": "http://velya.health/communication-category",
          "code": "critical-result-notification",
          "display": "Notificacao de Resultado Critico"
        }
      ]
    }
  ],
  "priority": "stat",
  "subject": {
    "reference": "Patient/pat-12345",
    "display": "Maria Santos"
  },
  "encounter": {
    "reference": "Encounter/enc-789"
  },
  "sent": "2026-04-09T14:30:00Z",
  "received": "2026-04-09T14:32:15Z",
  "sender": {
    "reference": "Practitioner/bio-ana",
    "display": "Biomedica Ana Souza - CRBM 5678/SP"
  },
  "recipient": [
    {
      "reference": "Practitioner/dr-silva",
      "display": "Dra. Ana Silva - CRM 12345/SP"
    }
  ],
  "about": [
    {
      "reference": "DiagnosticReport/lab-k-001",
      "display": "Potassio serico - Resultado critico"
    }
  ],
  "payload": [
    {
      "contentString": "RESULTADO CRITICO - Potassio: 6.8 mEq/L (ref: 3.5-5.0). Paciente Maria Santos, UTI-A Leito 3. Amostra coletada as 13:45. Comunicado verbalmente a Dra. Ana Silva as 14:32."
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/communication-acknowledgement",
      "valueReference": {
        "reference": "Communication/comm-critical-001-ack"
      }
    }
  ]
}
```

### 3.4 Exemplo FHIR: Acknowledgement do Resultado Critico

```json
{
  "resourceType": "Communication",
  "id": "comm-critical-001-ack",
  "status": "completed",
  "category": [
    {
      "coding": [
        {
          "system": "http://velya.health/communication-category",
          "code": "acknowledgement",
          "display": "Confirmacao de Recebimento"
        }
      ]
    }
  ],
  "inResponseTo": [
    {
      "reference": "Communication/comm-critical-001"
    }
  ],
  "subject": {
    "reference": "Patient/pat-12345"
  },
  "encounter": {
    "reference": "Encounter/enc-789"
  },
  "sent": "2026-04-09T14:32:30Z",
  "sender": {
    "reference": "Practitioner/dr-silva",
    "display": "Dra. Ana Silva - CRM 12345/SP"
  },
  "payload": [
    {
      "contentString": "Recebi. Vou solicitar ECG e iniciar protocolo de hipercalemia. Suspender IECA."
    }
  ]
}
```

### 3.5 Closed-Loop

Toda Communication de tipo critico requer closed-loop:

```
Sender (Lab)  ──── Communication (resultado critico) ────>  Recipient (Medico)
                                                                    │
Sender (Lab)  <──── Communication (acknowledgement) ────────────────┘
                    inResponseTo = Communication original

SE acknowledgement NAO recebido em 15 min:
  Sistema gera escalacao automatica
```

---

## 4. CareTeam: Contexto de Equipe

### 4.1 Conceito

O `CareTeam` define quem e responsavel por quem em cada momento. E o recurso central para controle de acesso baseado em contexto (ABAC).

### 4.2 Exemplo FHIR

```json
{
  "resourceType": "CareTeam",
  "id": "ct-enc-789",
  "status": "active",
  "category": [
    {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": "LA27976-2",
          "display": "Encounter-focused care team"
        }
      ]
    }
  ],
  "name": "Equipe Assistencial - Maria Santos - UTI-A",
  "subject": {
    "reference": "Patient/pat-12345",
    "display": "Maria Santos"
  },
  "encounter": {
    "reference": "Encounter/enc-789"
  },
  "period": {
    "start": "2026-04-07T10:00:00Z"
  },
  "participant": [
    {
      "role": [
        {
          "coding": [
            {
              "system": "http://velya.health/care-team-role",
              "code": "attending-physician",
              "display": "Medico Responsavel"
            }
          ]
        }
      ],
      "member": {
        "reference": "Practitioner/dr-silva",
        "display": "Dra. Ana Silva - CRM 12345/SP"
      },
      "period": {
        "start": "2026-04-07T10:00:00Z"
      }
    },
    {
      "role": [
        {
          "coding": [
            {
              "system": "http://velya.health/care-team-role",
              "code": "primary-nurse",
              "display": "Enfermeiro Responsavel"
            }
          ]
        }
      ],
      "member": {
        "reference": "Practitioner/enf-joana",
        "display": "Enf. Joana Pereira - COREN 987654/SP"
      },
      "period": {
        "start": "2026-04-09T19:00:00Z"
      }
    },
    {
      "role": [
        {
          "coding": [
            {
              "system": "http://velya.health/care-team-role",
              "code": "nursing-tech",
              "display": "Tecnico de Enfermagem"
            }
          ]
        }
      ],
      "member": {
        "reference": "Practitioner/tec-pedro",
        "display": "Tec. Enf. Pedro Alves - COREN 456789/SP"
      },
      "period": {
        "start": "2026-04-09T19:00:00Z"
      }
    },
    {
      "role": [
        {
          "coding": [
            {
              "system": "http://velya.health/care-team-role",
              "code": "consultant",
              "display": "Consultor"
            }
          ]
        }
      ],
      "member": {
        "reference": "Practitioner/dr-cardio",
        "display": "Dr. Roberto Mendes - CRM 67890/SP - Cardiologia"
      },
      "period": {
        "start": "2026-04-08T10:00:00Z"
      }
    }
  ],
  "managingOrganization": [
    {
      "reference": "Organization/hospital-central"
    }
  ]
}
```

### 4.3 Atualizacao do CareTeam

O CareTeam e atualizado automaticamente quando:

| Evento                      | Atualizacao                                 |
| --------------------------- | ------------------------------------------- |
| Handoff aceito              | Troca do membro na funcao correspondente    |
| Interconsulta aceita        | Adiciona consultor                          |
| Alta de consultoria         | Remove consultor (define `period.end`)      |
| Transferencia de unidade    | Troca de toda a equipe de enfermagem        |
| Troca de medico responsavel | Troca do `attending-physician`              |
| Inicio de turno             | Atualiza enfermeiro/tecnico conforme escala |

---

## 5. Encounter: Contexto do Encontro

### 5.1 Conceito

O `Encounter` e o container que agrupa todos os eventos de um encontro clinico. Toda Task, Communication, Observation e demais recursos referenciam o Encounter correspondente.

### 5.2 Exemplo FHIR

```json
{
  "resourceType": "Encounter",
  "id": "enc-789",
  "status": "in-progress",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "IMP",
    "display": "inpatient encounter"
  },
  "type": [
    {
      "coding": [
        {
          "system": "http://velya.health/encounter-type",
          "code": "surgical-admission",
          "display": "Internacao Cirurgica"
        }
      ]
    }
  ],
  "priority": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
        "code": "EL",
        "display": "elective"
      }
    ]
  },
  "subject": {
    "reference": "Patient/pat-12345",
    "display": "Maria Santos"
  },
  "participant": [
    {
      "type": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
              "code": "ATND",
              "display": "attender"
            }
          ]
        }
      ],
      "individual": {
        "reference": "Practitioner/dr-silva",
        "display": "Dra. Ana Silva"
      },
      "period": {
        "start": "2026-04-07T10:00:00Z"
      }
    }
  ],
  "period": {
    "start": "2026-04-07T10:00:00Z"
  },
  "reasonCode": [
    {
      "coding": [
        {
          "system": "http://icd.who.int/icd10",
          "code": "K80.1",
          "display": "Calculo da vesicula biliar com colecistite"
        }
      ]
    }
  ],
  "location": [
    {
      "location": {
        "reference": "Location/uti-a-leito-3",
        "display": "UTI-A, Leito 3"
      },
      "status": "active",
      "period": {
        "start": "2026-04-08T16:00:00Z"
      }
    },
    {
      "location": {
        "reference": "Location/enf-4b-leito-12",
        "display": "Enfermaria 4B, Leito 12"
      },
      "status": "completed",
      "period": {
        "start": "2026-04-07T10:00:00Z",
        "end": "2026-04-08T16:00:00Z"
      }
    }
  ],
  "serviceProvider": {
    "reference": "Organization/hospital-central"
  }
}
```

---

## 6. Provenance: Autoria e Integridade

### 6.1 Conceito

O `Provenance` e o selo de autoria e integridade de cada recurso FHIR. Todo recurso clinico criado ou alterado na Velya recebe um Provenance vinculado, respondendo: quem criou/alterou, quando, como, e a partir de qual informacao.

### 6.2 Quando Gerar Provenance

| Acao                        | Provenance  | Activity |
| --------------------------- | ----------- | -------- |
| Criacao de recurso          | Obrigatorio | `create` |
| Atualizacao de recurso      | Obrigatorio | `update` |
| Assinatura digital          | Obrigatorio | `sign`   |
| Importacao de outro sistema | Obrigatorio | `import` |
| Correcao/amendment          | Obrigatorio | `amend`  |
| Anulacao                    | Obrigatorio | `void`   |

### 6.3 Exemplo FHIR: Provenance de Evolucao Medica

```json
{
  "resourceType": "Provenance",
  "id": "prov-doc-001",
  "target": [
    {
      "reference": "DocumentReference/evolucao-medica-001"
    }
  ],
  "recorded": "2026-04-09T10:30:00Z",
  "activity": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion",
        "code": "LA",
        "display": "legally authenticated"
      }
    ]
  },
  "agent": [
    {
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
            "code": "author",
            "display": "Author"
          }
        ]
      },
      "who": {
        "reference": "Practitioner/dr-silva",
        "display": "Dra. Ana Silva - CRM 12345/SP"
      },
      "onBehalfOf": {
        "reference": "Organization/hospital-central"
      }
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
            "code": "attester",
            "display": "Attester"
          }
        ]
      },
      "who": {
        "reference": "Practitioner/dr-silva",
        "display": "Dra. Ana Silva - CRM 12345/SP"
      }
    }
  ],
  "entity": [
    {
      "role": "source",
      "what": {
        "reference": "Encounter/enc-789",
        "display": "Exame clinico realizado as 10:15"
      }
    }
  ],
  "signature": [
    {
      "type": [
        {
          "system": "urn:iso-astm:E1762-95:2013",
          "code": "1.2.840.10065.1.12.1.1",
          "display": "Author's Signature"
        }
      ],
      "when": "2026-04-09T10:30:00Z",
      "who": {
        "reference": "Practitioner/dr-silva"
      },
      "sigFormat": "application/jose",
      "data": "eyJhbGciOiJSUzI1NiJ9..."
    }
  ]
}
```

### 6.4 Cadeia de Provenance

Para recursos que passam por multiplas alteracoes, a cadeia de Provenance permite reconstituir toda a historia:

```
Provenance (create, 09/04 10:30)
  target: DocumentReference/evolucao-001 v1
  agent: Dra. Ana Silva
  activity: create
         │
         ▼
Provenance (amend, 09/04 14:00)
  target: DocumentReference/evolucao-001 v2
  agent: Dra. Ana Silva
  activity: amend
  entity: DocumentReference/evolucao-001 v1 (source)
  reason: "Complemento apos resultado de exame"
         │
         ▼
Provenance (sign, 09/04 14:05)
  target: DocumentReference/evolucao-001 v2
  agent: Dra. Ana Silva
  activity: sign
  signature: [assinatura digital]
```

---

## 7. AuditEvent: Trilha de Acesso

### 7.1 Conceito

O `AuditEvent` registra toda interacao de acesso com recursos FHIR. Diferente do Provenance (que registra autoria de criacao/modificacao), o AuditEvent registra **leitura, tentativas de acesso, exportacoes e acoes administrativas**.

### 7.2 Exemplo FHIR: Leitura de Prontuario

```json
{
  "resourceType": "AuditEvent",
  "id": "audit-read-001",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110110",
    "display": "Patient Record"
  },
  "subtype": [
    {
      "system": "http://hl7.org/fhir/restful-interaction",
      "code": "read",
      "display": "read"
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
        "reference": "Practitioner/enf-joana",
        "display": "Enf. Joana Pereira"
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
              "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
              "code": "TREAT"
            }
          ]
        }
      ]
    }
  ],
  "source": {
    "observer": {
      "reference": "Device/velya-api-gateway"
    }
  },
  "entity": [
    {
      "what": {
        "reference": "Patient/pat-12345"
      },
      "type": {
        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
        "code": "1",
        "display": "Person"
      }
    }
  ]
}
```

---

## 8. Interconexao: Como os Recursos se Relacionam

### 8.1 Cenario Completo: Resultado Critico

```
1. DiagnosticReport (resultado critico K+ = 6.8)
   │
   ├── Provenance (autoria: Biomedica Ana, lab)
   │
   ├── Communication (lab -> medico: resultado critico)
   │   │
   │   ├── Provenance (autoria: Biomedica Ana)
   │   │
   │   └── Communication (medico -> lab: acknowledgement)
   │       │
   │       └── Provenance (autoria: Dra. Silva)
   │
   ├── AuditEvent (Dra. Silva leu o resultado)
   │
   ├── Task (administrar gluconato de calcio - emergencia)
   │   │
   │   ├── owner: Enf. Joana (via CareTeam)
   │   ├── basedOn: MedicationRequest/protocolo-hipercalemia
   │   ├── Provenance (criacao: Dra. Silva)
   │   │
   │   └── Task.status -> completed
   │       │
   │       ├── MedicationAdministration (gluconato administrado)
   │       │   └── Provenance (autoria: Enf. Joana)
   │       │
   │       └── Provenance (conclusao: Enf. Joana)
   │
   ├── ServiceRequest (solicitar ECG)
   │   └── Provenance (autoria: Dra. Silva)
   │
   └── MedicationRequest (suspender IECA)
       └── Provenance (autoria: Dra. Silva)

Todos os recursos acima referenciam:
- Encounter/enc-789
- Patient/pat-12345
- CareTeam/ct-enc-789

Todos os acessos geram AuditEvent correspondente.
```

### 8.2 Grafo de Referencia

```
                          Patient
                             │
                         Encounter
                        /    │    \
                CareTeam    Task    Communication
                   │       / │ \        │
              Practitioner   │  MedicationRequest
                            │         │
                      Provenance  MedicationAdministration
                            │         │
                       AuditEvent  Provenance
```

---

## 9. Regras de Integridade Referencial

| Regra                                         | Descricao                                              |
| --------------------------------------------- | ------------------------------------------------------ |
| **Todo recurso clinico referencia Encounter** | Nenhum recurso clinico existe sem contexto de encontro |
| **Todo recurso clinico tem Provenance**       | Nenhum recurso existe sem selo de autoria              |
| **Toda Task tem owner**                       | Nenhuma tarefa existe sem responsavel                  |
| **Toda Communication tem sender e recipient** | Nenhuma comunicacao e anonima                          |
| **Todo CareTeam member tem periodo**          | Inicio e fim de participacao sao rastreados            |
| **Todo AuditEvent tem agent**                 | Nenhum acesso e sem identificacao                      |
| **Task.basedOn aponta para ordem valida**     | Tarefas de execucao devem ter ordem correspondente     |
| **Communication.inResponseTo fecha o loop**   | Acknowledgements referenciam a comunicacao original    |

---

## 10. Metricas de Integridade

```promql
# Recursos sem Provenance (deve ser 0)
sum(velya_resource_without_provenance_total)

# Tasks sem owner (deve ser 0)
sum(velya_task_without_owner_total)

# Communications sem acknowledgement (acima do SLA)
sum(velya_communication_unacknowledged_beyond_sla)

# CareTeam members sem periodo definido
sum(velya_careteam_member_without_period)

# Integridade referencial violada
sum(velya_referential_integrity_violations_total)
```

---

## 11. Consideracoes de Performance

| Aspecto                       | Estrategia                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| **Volume de Provenance**      | Um Provenance por recurso criado/alterado. Estimativa: 2-3x o volume de recursos clinicos. |
| **Volume de AuditEvent**      | Alto volume. Particionar por data + tenant. Cold storage apos 1 ano.                       |
| **Queries de cadeia**         | Indices em `target.reference` e `entity.what.reference` para reconstituicao rapida.        |
| **CareTeam updates**          | Atualizacoes frequentes (a cada handoff). Cache em Redis com TTL = turno.                  |
| **Communication closed-loop** | Monitor com janela temporal (CEP) para detectar falta de acknowledgement.                  |
