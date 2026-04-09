# Estrategia FHIR - Provenance e AuditEvent como Recursos de Primeira Classe

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

O FHIR R4 (via Medplum) e a espinha dorsal de dados clinicos da Velya Platform.
Cada evento do Patient Journey Ledger e mapeado para um ou mais recursos FHIR,
e cada recurso FHIR gera obrigatoriamente um **Provenance** e um **AuditEvent**.

### Principio Central

> **Nenhum recurso FHIR existe sem Provenance. Nenhum acesso existe sem AuditEvent.**

```
+------------------------------------------------------------------+
|  FHIR R4 (Medplum)                                               |
|                                                                   |
|  +----------+   +----------+   +----------+   +----------+       |
|  | Clinical |   | Workflow |   |Provenance|   |AuditEvent|       |
|  | Resources|-->| Resources|-->| (quem,   |-->| (quem    |       |
|  |          |   |          |   |  quando, |   |  acessou,|       |
|  |          |   |          |   |  por que) |   |  o que)  |       |
|  +----------+   +----------+   +----------+   +----------+       |
|                                                                   |
|  Encounter, Observation, MedicationRequest,                       |
|  MedicationAdministration, Procedure, Task,                       |
|  Communication, ServiceRequest, DiagnosticReport,                 |
|  Condition, CarePlan, EncounterHistory                            |
+------------------------------------------------------------------+
```

---

## 2. Recursos FHIR Utilizados no Patient Journey

### 2.1 Tabela de Mapeamento: Evento -> Recurso FHIR

| Tipo de Evento | Recurso FHIR Principal | Recursos Associados |
|---|---|---|
| `admission` | Encounter | Location, Practitioner, Condition |
| `transfer` | Encounter (update) + EncounterHistory | Location |
| `discharge` | Encounter (update) | EncounterHistory |
| `diagnosis` | Condition | Encounter |
| `assessment` | Observation | Encounter, Practitioner |
| `vital_signs` | Observation (category: vital-signs) | Encounter, Device |
| `pain_assessment` | Observation (code: pain-severity) | Encounter |
| `medication_request.*` | MedicationRequest | Encounter, Practitioner, Medication |
| `medication_administration.*` | MedicationAdministration | MedicationRequest, Encounter, Practitioner |
| `procedure` | Procedure | Encounter, Practitioner |
| `lab_result` | DiagnosticReport + Observation | ServiceRequest, Specimen |
| `imaging_result` | DiagnosticReport + ImagingStudy | ServiceRequest |
| `clinical_note` | DocumentReference | Encounter, Practitioner |
| `care_plan` | CarePlan | Condition, Goal, Activity |
| `patient_call` | Communication | Encounter, Patient |
| `call_response` | Communication (reply) | Communication (original) |
| `handoff_initiated` | Task (status: requested) | Encounter, Practitioner |
| `handoff_accepted` | Task (status: accepted) | Task (original) |
| `scheduling` | ServiceRequest | Encounter |
| `consent_obtained` | Consent | Patient, Organization |
| `record_accessed` | AuditEvent | Patient, Practitioner |
| `any_event` | Provenance | (recurso alvo) |

---

## 3. Exemplos FHIR por Recurso

### 3.1 Encounter (Internacao)

```json
{
  "resourceType": "Encounter",
  "id": "encounter-2026-0408-001",
  "meta": {
    "versionId": "3",
    "lastUpdated": "2026-04-08T12:05:00-03:00",
    "profile": [
      "http://velya.health/fhir/StructureDefinition/VelyaEncounter"
    ]
  },
  "identifier": [
    {
      "system": "http://velya.health/fhir/identifier/encounter",
      "value": "INT-2026-04081-001"
    }
  ],
  "status": "in-progress",
  "statusHistory": [
    {
      "status": "arrived",
      "period": {
        "start": "2026-04-05T08:30:00-03:00",
        "end": "2026-04-05T09:15:00-03:00"
      }
    },
    {
      "status": "in-progress",
      "period": {
        "start": "2026-04-05T09:15:00-03:00"
      }
    }
  ],
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "IMP",
    "display": "inpatient encounter"
  },
  "type": [
    {
      "coding": [
        {
          "system": "http://velya.health/fhir/CodeSystem/encounter-type",
          "code": "clinical-admission",
          "display": "Internacao Clinica"
        }
      ]
    }
  ],
  "priority": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
        "code": "UR",
        "display": "urgent"
      }
    ]
  },
  "subject": {
    "reference": "Patient/patient-001",
    "display": "Maria Silva Santos"
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
        "reference": "Practitioner/dr-carlos-mendes",
        "display": "Dr. Carlos Mendes"
      },
      "period": {
        "start": "2026-04-05T09:15:00-03:00"
      }
    },
    {
      "type": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
              "code": "PPRF",
              "display": "primary performer"
            }
          ]
        }
      ],
      "individual": {
        "reference": "Practitioner/enf-ana-paula",
        "display": "Enf. Ana Paula"
      },
      "period": {
        "start": "2026-04-08T12:05:00-03:00"
      }
    }
  ],
  "period": {
    "start": "2026-04-05T08:30:00-03:00"
  },
  "reasonCode": [
    {
      "coding": [
        {
          "system": "http://hl7.org/fhir/sid/icd-10",
          "code": "J18.9",
          "display": "Pneumonia nao especificada"
        }
      ],
      "text": "Pneumonia Comunitaria Grave"
    }
  ],
  "diagnosis": [
    {
      "condition": {
        "reference": "Condition/cond-pneumonia-001"
      },
      "use": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role",
            "code": "AD",
            "display": "Admission diagnosis"
          }
        ]
      },
      "rank": 1
    }
  ],
  "location": [
    {
      "location": {
        "reference": "Location/cm-412-a",
        "display": "Clinica Medica - Quarto 412 - Leito A"
      },
      "status": "active",
      "period": {
        "start": "2026-04-05T09:15:00-03:00"
      }
    }
  ],
  "serviceProvider": {
    "reference": "Organization/velya-hospital"
  }
}
```

### 3.2 EncounterHistory (Historico de Mudancas no Encounter)

```json
{
  "resourceType": "EncounterHistory",
  "id": "enc-hist-001",
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "status": "in-progress",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "IMP"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "actualPeriod": {
    "start": "2026-04-05T09:15:00-03:00"
  },
  "location": [
    {
      "location": {
        "reference": "Location/cm-412-a"
      }
    }
  ]
}
```

### 3.3 MedicationRequest (Prescricao)

```json
{
  "resourceType": "MedicationRequest",
  "id": "med-request-001",
  "meta": {
    "profile": [
      "http://velya.health/fhir/StructureDefinition/VelyaMedicationRequest"
    ]
  },
  "identifier": [
    {
      "system": "http://velya.health/fhir/identifier/prescription",
      "value": "PRESC-2026-04051-001-01"
    }
  ],
  "status": "active",
  "statusReason": {
    "coding": [
      {
        "system": "http://velya.health/fhir/CodeSystem/prescription-status-reason",
        "code": "treatment-ongoing",
        "display": "Tratamento em andamento"
      }
    ]
  },
  "intent": "order",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
          "code": "inpatient",
          "display": "Inpatient"
        }
      ]
    }
  ],
  "priority": "routine",
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://www.whocc.no/atc",
        "code": "J01CA04",
        "display": "Amoxicilina"
      },
      {
        "system": "http://velya.health/fhir/CodeSystem/medication",
        "code": "AMX-500-VO",
        "display": "Amoxicilina 500mg comprimido"
      }
    ],
    "text": "Amoxicilina 500mg"
  },
  "subject": {
    "reference": "Patient/patient-001",
    "display": "Maria Silva Santos"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "authoredOn": "2026-04-05T10:30:00-03:00",
  "requester": {
    "reference": "Practitioner/dr-carlos-mendes",
    "display": "Dr. Carlos Mendes"
  },
  "dosageInstruction": [
    {
      "sequence": 1,
      "text": "Tomar 500mg por via oral a cada 8 horas",
      "timing": {
        "repeat": {
          "frequency": 3,
          "period": 1,
          "periodUnit": "d",
          "timeOfDay": ["06:00", "14:00", "22:00"]
        }
      },
      "route": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "26643006",
            "display": "Oral route"
          }
        ]
      },
      "doseAndRate": [
        {
          "type": {
            "coding": [
              {
                "system": "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                "code": "ordered",
                "display": "Ordered"
              }
            ]
          },
          "doseQuantity": {
            "value": 500,
            "unit": "mg",
            "system": "http://unitsofmeasure.org",
            "code": "mg"
          }
        }
      ]
    }
  ],
  "dispenseRequest": {
    "validityPeriod": {
      "start": "2026-04-05T10:30:00-03:00",
      "end": "2026-04-12T10:30:00-03:00"
    },
    "numberOfRepeatsAllowed": 0,
    "quantity": {
      "value": 21,
      "unit": "comprimido",
      "system": "http://velya.health/fhir/CodeSystem/unit",
      "code": "comp"
    },
    "expectedSupplyDuration": {
      "value": 7,
      "unit": "dias",
      "system": "http://unitsofmeasure.org",
      "code": "d"
    }
  }
}
```

### 3.4 MedicationAdministration (Administracao)

```json
{
  "resourceType": "MedicationAdministration",
  "id": "med-admin-001",
  "meta": {
    "profile": [
      "http://velya.health/fhir/StructureDefinition/VelyaMedicationAdministration"
    ]
  },
  "identifier": [
    {
      "system": "http://velya.health/fhir/identifier/administration",
      "value": "ADM-2026-04081-001-01-03"
    }
  ],
  "status": "completed",
  "category": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/medication-admin-category",
        "code": "inpatient",
        "display": "Inpatient"
      }
    ]
  },
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://www.whocc.no/atc",
        "code": "J01CA04",
        "display": "Amoxicilina"
      }
    ],
    "text": "Amoxicilina 500mg"
  },
  "subject": {
    "reference": "Patient/patient-001",
    "display": "Maria Silva Santos"
  },
  "context": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "effectiveDateTime": "2026-04-08T14:35:00-03:00",
  "performer": [
    {
      "function": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/med-admin-perform-function",
            "code": "performer",
            "display": "Performer"
          }
        ]
      },
      "actor": {
        "reference": "Practitioner/enf-ana-paula",
        "display": "Enf. Ana Paula"
      }
    }
  ],
  "request": {
    "reference": "MedicationRequest/med-request-001"
  },
  "dosage": {
    "text": "500mg via oral",
    "route": {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "26643006",
          "display": "Oral route"
        }
      ]
    },
    "dose": {
      "value": 500,
      "unit": "mg",
      "system": "http://unitsofmeasure.org",
      "code": "mg"
    }
  },
  "note": [
    {
      "authorReference": {
        "reference": "Practitioner/enf-ana-paula"
      },
      "time": "2026-04-08T14:37:00-03:00",
      "text": "Administrado com atraso de 35 minutos. Paciente estava em banho assistido no horario previsto."
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/scheduled-time",
      "valueDateTime": "2026-04-08T14:00:00-03:00"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/delay-minutes",
      "valueInteger": 35
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/double-check",
      "valueBoolean": false
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/pain-before",
      "valueInteger": 4
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/lot-number",
      "valueString": "LOT2026A"
    }
  ]
}
```

### 3.5 Observation (Sinais Vitais)

```json
{
  "resourceType": "Observation",
  "id": "obs-vitals-001",
  "meta": {
    "profile": [
      "http://hl7.org/fhir/StructureDefinition/vitalsigns"
    ]
  },
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "85354-9",
        "display": "Blood pressure panel"
      }
    ]
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "effectiveDateTime": "2026-04-08T14:22:00-03:00",
  "performer": [
    {
      "reference": "Practitioner/tec-roberto",
      "display": "Tec. Enf. Roberto"
    }
  ],
  "component": [
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8480-6",
            "display": "Systolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 130,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    },
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8462-4",
            "display": "Diastolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 85,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    }
  ]
}
```

### 3.6 Observation (Avaliacao de Dor)

```json
{
  "resourceType": "Observation",
  "id": "obs-pain-001",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "survey",
          "display": "Survey"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "72514-3",
        "display": "Pain severity - 0-10 verbal numeric rating"
      }
    ],
    "text": "Avaliacao de Dor - Escala Numerica"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "effectiveDateTime": "2026-04-08T13:45:00-03:00",
  "performer": [
    {
      "reference": "Practitioner/enf-ana-paula"
    }
  ],
  "valueInteger": 6,
  "interpretation": [
    {
      "coding": [
        {
          "system": "http://velya.health/fhir/CodeSystem/pain-interpretation",
          "code": "moderate-severe",
          "display": "Dor moderada a severa"
        }
      ]
    }
  ],
  "bodySite": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "51185008",
        "display": "Thorax"
      }
    ],
    "text": "Torax - regiao anterior"
  },
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/pain-trend",
      "valueCode": "worsening"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/pain-character",
      "valueString": "pontada"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/reassessment-due",
      "valueDateTime": "2026-04-08T15:45:00-03:00"
    }
  ]
}
```

### 3.7 Procedure (Procedimento)

```json
{
  "resourceType": "Procedure",
  "id": "proc-001",
  "status": "completed",
  "category": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "103693007",
        "display": "Diagnostic procedure"
      }
    ]
  },
  "code": {
    "coding": [
      {
        "system": "http://velya.health/fhir/CodeSystem/procedure",
        "code": "BRONC-DX",
        "display": "Broncoscopia diagnostica"
      }
    ],
    "text": "Broncoscopia diagnostica com lavado broncoalveolar"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "performedPeriod": {
    "start": "2026-04-06T10:00:00-03:00",
    "end": "2026-04-06T10:45:00-03:00"
  },
  "performer": [
    {
      "function": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "304292004",
            "display": "Surgeon"
          }
        ]
      },
      "actor": {
        "reference": "Practitioner/dr-fernanda-lima",
        "display": "Dra. Fernanda Lima - Pneumologista"
      }
    }
  ],
  "reasonReference": [
    {
      "reference": "Condition/cond-pneumonia-001"
    }
  ],
  "outcome": {
    "text": "Procedimento sem intercorrencias. Coletado lavado broncoalveolar para cultura."
  },
  "note": [
    {
      "text": "Paciente tolerou bem o procedimento. Sem complicacoes imediatas."
    }
  ]
}
```

### 3.8 ServiceRequest (Solicitacao)

```json
{
  "resourceType": "ServiceRequest",
  "id": "sr-hemocultura-001",
  "status": "active",
  "intent": "order",
  "priority": "urgent",
  "category": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "108252007",
          "display": "Laboratory procedure"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "600-7",
        "display": "Bacteria identified in Blood by Culture"
      }
    ],
    "text": "Hemocultura"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "authoredOn": "2026-04-08T10:15:00-03:00",
  "requester": {
    "reference": "Practitioner/dr-carlos-mendes"
  },
  "reasonReference": [
    {
      "reference": "Condition/cond-pneumonia-001"
    }
  ],
  "note": [
    {
      "text": "Coletar 2 amostras de sitios diferentes. Paciente febril persistente."
    }
  ]
}
```

### 3.9 DiagnosticReport (Resultado)

```json
{
  "resourceType": "DiagnosticReport",
  "id": "dr-hemocultura-001",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
          "code": "MB",
          "display": "Microbiology"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "600-7",
        "display": "Bacteria identified in Blood by Culture"
      }
    ]
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "effectiveDateTime": "2026-04-08T14:00:00-03:00",
  "issued": "2026-04-08T14:15:00-03:00",
  "performer": [
    {
      "reference": "Organization/velya-lab"
    }
  ],
  "basedOn": [
    {
      "reference": "ServiceRequest/sr-hemocultura-001"
    }
  ],
  "result": [
    {
      "reference": "Observation/obs-hemocultura-001"
    }
  ],
  "conclusion": "Hemocultura positiva para Streptococcus pneumoniae. Sensivel a amoxicilina."
}
```

### 3.10 Task (Handoff / Tarefas)

```json
{
  "resourceType": "Task",
  "id": "task-handoff-001",
  "meta": {
    "profile": [
      "http://velya.health/fhir/StructureDefinition/VelyaHandoffTask"
    ]
  },
  "identifier": [
    {
      "system": "http://velya.health/fhir/identifier/handoff",
      "value": "HO-2026-04081-001"
    }
  ],
  "status": "accepted",
  "statusReason": {
    "text": "Passagem de plantao turno manha para turno tarde"
  },
  "intent": "order",
  "priority": "routine",
  "code": {
    "coding": [
      {
        "system": "http://velya.health/fhir/CodeSystem/task-type",
        "code": "handoff",
        "display": "Passagem de Plantao"
      }
    ]
  },
  "description": "Passagem de plantao - Paciente Maria Silva Santos - CM 412A",
  "focus": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "for": {
    "reference": "Patient/patient-001"
  },
  "authoredOn": "2026-04-08T12:02:00-03:00",
  "lastModified": "2026-04-08T12:05:00-03:00",
  "requester": {
    "reference": "Practitioner/enf-roberto-silva",
    "display": "Enf. Roberto Silva"
  },
  "owner": {
    "reference": "Practitioner/enf-ana-paula",
    "display": "Enf. Ana Paula"
  },
  "input": [
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-input",
            "code": "situation",
            "display": "Situacao (S - SBAR)"
          }
        ]
      },
      "valueString": "Paciente 67 anos, internada por pneumonia comunitaria grave ha 3 dias. Estavel clinicamente."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-input",
            "code": "background",
            "display": "Antecedentes (B - SBAR)"
          }
        ]
      },
      "valueString": "HAS, DM2. Alergia a penicilina (severa) e dipirona (moderada). Em uso de amoxicilina, enoxaparina."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-input",
            "code": "assessment",
            "display": "Avaliacao (A - SBAR)"
          }
        ]
      },
      "valueString": "NEWS 3, estavel. Dor toracica referida melhora parcial. Aguardando resultado hemocultura."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-input",
            "code": "recommendation",
            "display": "Recomendacao (R - SBAR)"
          }
        ]
      },
      "valueString": "Verificar resultado hemocultura quando disponivel. Reavaliar dor apos proxima dose de analgesico. Manter protocolos atuais."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-input",
            "code": "pending-items",
            "display": "Pendencias"
          }
        ]
      },
      "valueString": "[CRITICO] Resultado hemocultura pendente analise; [ALTO] Amoxicilina 14:00; [MEDIO] Reavaliacao dor devida 12:30"
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-format",
      "valueCode": "SBAR"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-acceptance-time",
      "valueDateTime": "2026-04-08T12:05:00-03:00"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-transition-seconds",
      "valueInteger": 180
    }
  ]
}
```

### 3.11 CarePlan (Plano de Cuidados)

```json
{
  "resourceType": "CarePlan",
  "id": "careplan-001",
  "status": "active",
  "intent": "plan",
  "title": "Plano de cuidados - Pneumonia Comunitaria",
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "period": {
    "start": "2026-04-05T10:00:00-03:00"
  },
  "author": {
    "reference": "Practitioner/dr-carlos-mendes"
  },
  "addresses": [
    {
      "reference": "Condition/cond-pneumonia-001"
    }
  ],
  "goal": [
    {
      "reference": "Goal/goal-afebril"
    },
    {
      "reference": "Goal/goal-dor-controlada"
    }
  ],
  "activity": [
    {
      "detail": {
        "kind": "MedicationRequest",
        "code": {
          "text": "Antibioticoterapia com Amoxicilina 500mg 8/8h por 7 dias"
        },
        "status": "in-progress",
        "scheduledPeriod": {
          "start": "2026-04-05",
          "end": "2026-04-12"
        }
      }
    },
    {
      "detail": {
        "kind": "ServiceRequest",
        "code": {
          "text": "Controle de sinais vitais 4/4h"
        },
        "status": "in-progress"
      }
    },
    {
      "detail": {
        "kind": "ServiceRequest",
        "code": {
          "text": "Fisioterapia respiratoria 2x/dia"
        },
        "status": "in-progress"
      }
    }
  ]
}
```

### 3.12 Condition (Diagnostico)

```json
{
  "resourceType": "Condition",
  "id": "cond-pneumonia-001",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active"
      }
    ]
  },
  "verificationStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        "code": "confirmed"
      }
    ]
  },
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-category",
          "code": "encounter-diagnosis"
        }
      ]
    }
  ],
  "severity": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "24484000",
        "display": "Severe"
      }
    ]
  },
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10",
        "code": "J18.9",
        "display": "Pneumonia, unspecified organism"
      }
    ],
    "text": "Pneumonia Comunitaria Grave"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "onsetDateTime": "2026-04-04T00:00:00-03:00",
  "recordedDate": "2026-04-05T09:30:00-03:00",
  "recorder": {
    "reference": "Practitioner/dr-carlos-mendes"
  }
}
```

### 3.13 Communication (Chamados e Mensagens)

```json
{
  "resourceType": "Communication",
  "id": "comm-call-001",
  "meta": {
    "profile": [
      "http://velya.health/fhir/StructureDefinition/VelyaPatientCall"
    ]
  },
  "status": "completed",
  "category": [
    {
      "coding": [
        {
          "system": "http://velya.health/fhir/CodeSystem/communication-category",
          "code": "patient-call",
          "display": "Chamado do Paciente"
        }
      ]
    }
  ],
  "priority": "routine",
  "subject": {
    "reference": "Patient/patient-001"
  },
  "encounter": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "sent": "2026-04-08T13:54:00-03:00",
  "received": "2026-04-08T13:58:00-03:00",
  "sender": {
    "reference": "Patient/patient-001",
    "display": "Maria Silva Santos"
  },
  "recipient": [
    {
      "reference": "Practitioner/enf-ana-paula",
      "display": "Enf. Ana Paula"
    }
  ],
  "payload": [
    {
      "contentString": "Chamado de dor - botao de leito. Paciente refere piora da dor toracica."
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/call-source",
      "valueCode": "bed_button"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/call-category",
      "valueCode": "pain"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/response-time-seconds",
      "valueInteger": 240
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/resolution-time-seconds",
      "valueInteger": 720
    }
  ]
}
```

---

## 4. Provenance - Recurso de Primeira Classe

### 4.1 Politica de Provenance

Cada recurso clinico criado ou modificado DEVE gerar um Provenance correspondente.

```
Recurso Clinico (criacao/modificacao)
        |
        v
+------------------+
| Provenance       |
| - quem fez       |
| - quando         |
| - por que        |
| - em nome de quem|
| - que recurso    |
| - baseado em que |
| - com assinatura?|
+------------------+
```

### 4.2 Exemplo de Provenance

```json
{
  "resourceType": "Provenance",
  "id": "prov-med-admin-001",
  "target": [
    {
      "reference": "MedicationAdministration/med-admin-001"
    }
  ],
  "occurredDateTime": "2026-04-08T14:35:00-03:00",
  "recorded": "2026-04-08T14:37:22-03:00",
  "reason": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
          "code": "TREAT",
          "display": "Treatment"
        }
      ]
    }
  ],
  "activity": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
        "code": "CREATE",
        "display": "Create"
      }
    ]
  },
  "agent": [
    {
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
            "code": "performer",
            "display": "Performer"
          }
        ]
      },
      "who": {
        "reference": "Practitioner/enf-ana-paula",
        "display": "Enf. Ana Paula (COREN 67890)"
      },
      "onBehalfOf": {
        "reference": "Organization/velya-hospital"
      }
    },
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
        "reference": "Practitioner/dr-carlos-mendes",
        "display": "Dr. Carlos Mendes (CRM 12345)"
      }
    }
  ],
  "entity": [
    {
      "role": "source",
      "what": {
        "reference": "MedicationRequest/med-request-001",
        "display": "Prescricao de Amoxicilina 500mg"
      }
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/documentation-delay-seconds",
      "valueInteger": 142
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/source-system",
      "valueString": "velya-nursing"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/workstation-id",
      "valueString": "ws-cm-floor4-01"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/patient-journey-event-id",
      "valueString": "01912f3a-4b5c-7d8e-9f0a-1b2c3d4e5f6a"
    }
  ]
}
```

### 4.3 Provenance para Correcoes

```json
{
  "resourceType": "Provenance",
  "id": "prov-correction-vitals-001",
  "target": [
    {
      "reference": "Observation/obs-vitals-001"
    }
  ],
  "occurredDateTime": "2026-04-08T15:20:00-03:00",
  "recorded": "2026-04-08T15:20:15-03:00",
  "reason": [
    {
      "coding": [
        {
          "system": "http://velya.health/fhir/CodeSystem/correction-reason",
          "code": "data-entry-error",
          "display": "Erro de digitacao"
        }
      ],
      "text": "Correcao de PA: digitado 180/110 quando correto era 130/85"
    }
  ],
  "activity": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
        "code": "UPDATE",
        "display": "Update"
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
        "reference": "Practitioner/enf-ana-paula"
      }
    }
  ],
  "entity": [
    {
      "role": "revision",
      "what": {
        "reference": "Observation/obs-vitals-001/_history/1",
        "display": "Versao original com valores incorretos"
      }
    }
  ]
}
```

---

## 5. AuditEvent - Recurso de Primeira Classe

### 5.1 Politica de AuditEvent

Cada acesso, visualizacao, exportacao ou tentativa de acesso a dados do paciente
DEVE gerar um AuditEvent.

### 5.2 Exemplo: Acesso ao Prontuario

```json
{
  "resourceType": "AuditEvent",
  "id": "audit-access-001",
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
    "start": "2026-04-08T14:45:00-03:00",
    "end": "2026-04-08T14:52:00-03:00"
  },
  "recorded": "2026-04-08T14:45:00-03:00",
  "outcome": "0",
  "outcomeDesc": "Acesso autorizado - medico assistente",
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
        "reference": "Practitioner/dr-carlos-mendes",
        "display": "Dr. Carlos Mendes"
      },
      "requestor": true,
      "network": {
        "address": "10.0.1.45",
        "type": "2"
      }
    }
  ],
  "source": {
    "observer": {
      "reference": "Device/velya-ehr-server-01"
    },
    "type": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/security-source-type",
        "code": "4",
        "display": "Application Server"
      }
    ]
  },
  "entity": [
    {
      "what": {
        "reference": "Patient/patient-001"
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
        "reference": "Encounter/encounter-2026-0408-001"
      },
      "type": {
        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
        "code": "2",
        "display": "System Object"
      }
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/sections-viewed",
      "valueString": "timeline,medications,vitals,lab_results"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/session-id",
      "valueString": "sess-abc123"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/user-agent",
      "valueString": "VelyaEHR/2.1.0 Chrome/124"
    }
  ]
}
```

### 5.3 Exemplo: Break-Glass

```json
{
  "resourceType": "AuditEvent",
  "id": "audit-breakglass-001",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110113",
    "display": "Security Alert"
  },
  "subtype": [
    {
      "system": "http://velya.health/fhir/CodeSystem/audit-subtype",
      "code": "break-glass",
      "display": "Acesso de emergencia (Break-Glass)"
    }
  ],
  "action": "R",
  "recorded": "2026-04-08T03:15:00-03:00",
  "outcome": "0",
  "outcomeDesc": "Break-glass autorizado - emergencia clinica",
  "purposeOfEvent": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
          "code": "ETREAT",
          "display": "Emergency Treatment"
        }
      ],
      "text": "Paciente com rebaixamento de consciencia subito. Necessidade de acesso imediato ao prontuario para verificar medicacoes e alergias."
    }
  ],
  "agent": [
    {
      "who": {
        "reference": "Practitioner/dr-plantonista-noite",
        "display": "Dr. Pedro Nogueira - Plantonista"
      },
      "requestor": true,
      "network": {
        "address": "10.0.1.80",
        "type": "2"
      }
    }
  ],
  "source": {
    "observer": {
      "reference": "Device/velya-ehr-server-01"
    }
  },
  "entity": [
    {
      "what": {
        "reference": "Patient/patient-001"
      },
      "role": {
        "system": "http://terminology.hl7.org/CodeSystem/object-role",
        "code": "1",
        "display": "Patient"
      }
    }
  ]
}
```

### 5.4 Exemplo: Exportacao de Dados

```json
{
  "resourceType": "AuditEvent",
  "id": "audit-export-001",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110106",
    "display": "Export"
  },
  "subtype": [
    {
      "system": "http://velya.health/fhir/CodeSystem/audit-subtype",
      "code": "timeline-export",
      "display": "Exportacao de Timeline"
    }
  ],
  "action": "R",
  "recorded": "2026-04-08T16:00:00-03:00",
  "outcome": "0",
  "agent": [
    {
      "who": {
        "reference": "Practitioner/dr-carlos-mendes"
      },
      "requestor": true
    }
  ],
  "source": {
    "observer": {
      "reference": "Device/velya-ehr-server-01"
    }
  },
  "entity": [
    {
      "what": {
        "reference": "Patient/patient-001"
      },
      "role": {
        "system": "http://terminology.hl7.org/CodeSystem/object-role",
        "code": "1"
      }
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/export-format",
      "valueCode": "pdf"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/export-scope",
      "valueString": "full_encounter"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/export-filters",
      "valueString": "categories=clinical,operational; period=2026-04-05..2026-04-08"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/export-included-provenance",
      "valueBoolean": true
    }
  ]
}
```

---

## 6. TypeScript - Servico de Provenance e AuditEvent

```typescript
interface ProvenanceService {
  /**
   * Cria Provenance para qualquer recurso FHIR criado ou modificado.
   * Chamado automaticamente pelo middleware de persistencia.
   */
  createProvenance(params: {
    targetResource: FHIRResource;
    activity: 'CREATE' | 'UPDATE' | 'DELETE';
    agents: Array<{
      type: 'performer' | 'author' | 'informant' | 'verifier' | 'legal';
      practitionerId: string;
      onBehalfOf?: string;
    }>;
    reason: string;
    sourceEntities?: Array<{
      reference: string;
      role: 'source' | 'derivation' | 'revision' | 'quotation' | 'removal';
    }>;
    metadata: {
      sourceSystem: string;
      workstationId?: string;
      documentationDelaySeconds?: number;
      patientJourneyEventId?: string;
    };
  }): Promise<Provenance>;

  /**
   * Busca cadeia de proveniencia de um recurso.
   * Retorna toda a arvore de derivacoes e revisoes.
   */
  getProvenanceChain(resourceReference: string): Promise<Provenance[]>;

  /**
   * Valida integridade da cadeia de proveniencia.
   */
  validateProvenanceChain(
    resourceReference: string
  ): Promise<{
    valid: boolean;
    issues: string[];
    chainLength: number;
  }>;
}

interface AuditEventService {
  /**
   * Registra acesso a recurso do paciente.
   * Chamado automaticamente pelo middleware de autorizacao.
   */
  recordAccess(params: {
    action: 'R' | 'C' | 'U' | 'D' | 'E'; // Read, Create, Update, Delete, Execute
    practitionerId: string;
    patientId: string;
    encounterId?: string;
    resources: string[];
    sectionsViewed?: string[];
    sectionsExpanded?: string[];
    duration?: number;
    breakGlass?: {
      activated: boolean;
      reason: string;
    };
    export?: {
      format: string;
      scope: string;
      filters: string;
    };
    network: {
      ip: string;
      userAgent: string;
    };
    sessionId: string;
  }): Promise<AuditEvent>;

  /**
   * Consulta log de auditoria de um paciente.
   */
  queryAuditLog(params: {
    patientId: string;
    period?: { start: string; end: string };
    actions?: string[];
    agents?: string[];
    breakGlassOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    total: number;
    entries: AuditEvent[];
  }>;

  /**
   * Gera relatorio de acessos para compliance.
   */
  generateAccessReport(params: {
    patientId: string;
    period: { start: string; end: string };
    format: 'pdf' | 'csv' | 'json';
  }): Promise<Buffer>;
}
```

---

## 7. Middleware de Provenance Automatico

```typescript
/**
 * Middleware Medplum que intercepta todas as operacoes FHIR
 * e gera Provenance automaticamente.
 */
class ProvenanceMiddleware {
  private provenanceService: ProvenanceService;
  private auditService: AuditEventService;

  async onResourceCreated(
    resource: FHIRResource,
    context: RequestContext
  ): Promise<void> {
    // 1. Criar Provenance
    await this.provenanceService.createProvenance({
      targetResource: resource,
      activity: 'CREATE',
      agents: [
        {
          type: 'author',
          practitionerId: context.practitionerId,
          onBehalfOf: context.organizationId,
        },
      ],
      reason: context.reason || 'Clinical documentation',
      metadata: {
        sourceSystem: context.sourceSystem,
        workstationId: context.workstationId,
        documentationDelaySeconds: context.documentationDelay,
        patientJourneyEventId: context.journeyEventId,
      },
    });

    // 2. Registrar AuditEvent
    await this.auditService.recordAccess({
      action: 'C',
      practitionerId: context.practitionerId,
      patientId: this.extractPatientId(resource),
      encounterId: this.extractEncounterId(resource),
      resources: [`${resource.resourceType}/${resource.id}`],
      network: {
        ip: context.clientIp,
        userAgent: context.userAgent,
      },
      sessionId: context.sessionId,
    });
  }

  async onResourceRead(
    resource: FHIRResource,
    context: RequestContext
  ): Promise<void> {
    // Apenas AuditEvent para leituras
    await this.auditService.recordAccess({
      action: 'R',
      practitionerId: context.practitionerId,
      patientId: this.extractPatientId(resource),
      resources: [`${resource.resourceType}/${resource.id}`],
      network: {
        ip: context.clientIp,
        userAgent: context.userAgent,
      },
      sessionId: context.sessionId,
    });
  }

  async onResourceUpdated(
    resource: FHIRResource,
    previousVersion: FHIRResource,
    context: RequestContext
  ): Promise<void> {
    // Provenance com referencia a versao anterior
    await this.provenanceService.createProvenance({
      targetResource: resource,
      activity: 'UPDATE',
      agents: [
        {
          type: 'author',
          practitionerId: context.practitionerId,
        },
      ],
      reason: context.reason || 'Record update',
      sourceEntities: [
        {
          reference: `${previousVersion.resourceType}/${previousVersion.id}/_history/${previousVersion.meta?.versionId}`,
          role: 'revision',
        },
      ],
      metadata: {
        sourceSystem: context.sourceSystem,
        workstationId: context.workstationId,
        patientJourneyEventId: context.journeyEventId,
      },
    });

    await this.auditService.recordAccess({
      action: 'U',
      practitionerId: context.practitionerId,
      patientId: this.extractPatientId(resource),
      resources: [`${resource.resourceType}/${resource.id}`],
      network: {
        ip: context.clientIp,
        userAgent: context.userAgent,
      },
      sessionId: context.sessionId,
    });
  }

  private extractPatientId(resource: FHIRResource): string {
    if (resource.resourceType === 'Patient') return resource.id!;
    const subjectRef =
      (resource as any).subject?.reference ||
      (resource as any).patient?.reference;
    return subjectRef?.replace('Patient/', '') || 'unknown';
  }

  private extractEncounterId(resource: FHIRResource): string | undefined {
    const encounterRef =
      (resource as any).encounter?.reference ||
      (resource as any).context?.reference;
    return encounterRef?.replace('Encounter/', '');
  }
}
```

---

## 8. Validacao de Integridade

### 8.1 Regras de Validacao

| Regra | Descricao | Severidade |
|---|---|---|
| Provenance obrigatorio | Todo recurso clinico deve ter Provenance | Critico |
| Agente valido | Provenance deve ter ao menos um agente identificado | Critico |
| Recurso alvo valido | Target do Provenance deve existir | Critico |
| Timestamp consistente | recorded >= occurred | Alto |
| AuditEvent para acesso | Todo acesso deve gerar AuditEvent | Alto |
| Cadeia de revisoes | Updates devem referenciar versao anterior | Medio |
| Break-glass justificado | Break-glass sem justificativa gera alerta | Critico |

### 8.2 Job de Validacao

```typescript
interface ProvenanceIntegrityJob {
  schedule: '*/15 * * * *'; // A cada 15 minutos
  
  checks: [
    'orphaned_resources',      // Recursos sem Provenance
    'broken_chains',           // Cadeias de revisao quebradas
    'missing_agents',          // Provenance sem agente
    'timestamp_anomalies',     // Timestamps inconsistentes
    'unaudited_accesses',      // Acessos sem AuditEvent
    'unjustified_breakglass',  // Break-glass sem justificativa
  ];

  actions: {
    on_orphan: 'create_system_provenance_and_alert';
    on_broken_chain: 'alert_admin';
    on_missing_agent: 'alert_admin';
    on_timestamp_anomaly: 'flag_for_review';
    on_unaudited: 'create_retroactive_audit_and_alert';
    on_unjustified_breakglass: 'alert_security_officer';
  };
}
```

---

## Referencias

- [FHIR R4 Provenance](https://www.hl7.org/fhir/provenance.html)
- [FHIR R4 AuditEvent](https://www.hl7.org/fhir/auditevent.html)
- [FHIR R4 Encounter](https://www.hl7.org/fhir/encounter.html)
- [FHIR R4 MedicationRequest](https://www.hl7.org/fhir/medicationrequest.html)
- [FHIR R4 MedicationAdministration](https://www.hl7.org/fhir/medicationadministration.html)
- [FHIR R4 Observation](https://www.hl7.org/fhir/observation.html)
- [FHIR R4 Task](https://www.hl7.org/fhir/task.html)
- [FHIR R4 Communication](https://www.hl7.org/fhir/communication.html)
- [Medplum Documentation](https://www.medplum.com/docs)
