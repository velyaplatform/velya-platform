# Domain Map — Bounded Contexts, Agregados, Comandos e Eventos

> Mapa de domínio seguindo Domain-Driven Design (DDD) para os 12 macrodomínios do Velya
> Hospital Operating System. Cada contexto é descrito com agregados, comandos, eventos e
> interações entre contextos.

---

## 1. Princípios de modelagem

- **Bounded context** é a unidade de deploy, schema e time de evolução.
- **Linguagem ubíqua** é preservada por contexto — a mesma palavra pode ter significados
  diferentes (ex.: "alta" no Clinical Care vs. "alta" no Revenue Cycle).
- **Agregados** protegem invariantes; não há update parcial, só comandos.
- **Eventos** são imutáveis, nomeados no passado (`Prescribed`, `Administered`, `Discharged`).
- **Comandos** são imperativos (`PrescribeMedication`, `AdministerDose`, `DischargePatient`).
- **Integração entre contextos** sempre por eventos assíncronos ou por APIs explicitamente
  públicas; acesso direto ao DB de outro contexto é proibido.

---

## 2. Macrodomínio 1 — Clinical Care

### Contextos

- `clinical-encounter` — admissão, internação, alta.
- `clinical-notes` — evolução, anamnese, exame físico.
- `clinical-orders` — CPOE, ordens médicas e de enfermagem.
- `clinical-decision` — alertas, scores, sugestões.
- `clinical-safety` — alergias, eventos adversos, near miss.

### Agregados principais

- `Encounter` (com estado: planned, arrived, in-progress, finished, cancelled).
- `ClinicalNote` (imutável após assinatura).
- `Order` (com máquina de estados: draft, signed, validated, active, completed, cancelled).
- `AllergyIntolerance`.
- `AdverseEvent`.

### Comandos / Eventos

```
Commands                         Events
─────────────────────────────    ───────────────────────────────────
AdmitPatient                     EncounterStarted
RecordVitalSigns                 VitalSignsRecorded
SignClinicalNote                 ClinicalNoteSigned
PlaceOrder                       OrderPlaced
CancelOrder                      OrderCancelled
RecordAllergy                    AllergyRecorded
ReportAdverseEvent               AdverseEventReported
DischargePatient                 EncounterFinished
```

---

## 3. Macrodomínio 2 — Patient Journey

### Contextos

- `journey-timeline` — projeção unificada do paciente no tempo.
- `journey-personas` — views por persona (médico, enfermagem, financeiro, paciente).
- `journey-milestones` — marcos clínicos (admissão, cirurgia, alta).

### Agregados

- `JourneyProjection` (read model materializado).
- `Milestone`.

### Comandos / Eventos

```
Commands                         Events
─────────────────────────────    ───────────────────────────────────
RebuildJourney                   JourneyRebuilt
RecordMilestone                  MilestoneRecorded
```

Este contexto é majoritariamente consumidor de eventos dos demais domínios.

---

## 4. Macrodomínio 3 — Medication

### Contextos

- `medication-prescription` — prescrição médica estruturada.
- `medication-dispensing` — dispensação e unit dose.
- `medication-administration` — beira-leito.
- `medication-infusion` — bombas e smart pumps.
- `medication-closed-loop` — orquestração do ciclo completo.

### Agregados

- `Prescription`.
- `DispensingOrder`.
- `MedicationAdministrationRecord` (MAR).
- `InfusionSession`.

### Comandos / Eventos

```
Commands                         Events
─────────────────────────────    ───────────────────────────────────
PrescribeMedication              MedicationPrescribed
ReviewPrescription               PrescriptionReviewed
DispenseDose                     DoseDispensed
PrepareDose                      DosePrepared
AdministerDose                   DoseAdministered
InterruptInfusion                InfusionInterrupted
ReturnDose                       DoseReturned
```

---

## 5. Macrodomínio 4 — Ancillary Services

### Contextos

- `ancillary-lab` — LIS.
- `ancillary-imaging` — RIS/PACS integrado.
- `ancillary-pathology`.
- `ancillary-nutrition`.
- `ancillary-bloodbank`.
- `ancillary-rehab`.

### Agregados

- `ServiceRequest`.
- `Specimen`.
- `DiagnosticReport`.
- `ImagingStudy`.

### Comandos / Eventos (lab como exemplo)

```
CreateServiceRequest             ServiceRequestCreated
CollectSpecimen                  SpecimenCollected
ProcessSpecimen                  SpecimenProcessed
ReleaseResult                    ResultReleased
```

---

## 6. Macrodomínio 5 — Patient Support

### Contextos

- `patient-support-appointments` — agendamentos ambulatoriais.
- `patient-support-portal` — portal do paciente.
- `patient-support-transport` — transporte intra-hospitalar.
- `patient-support-discharge-planning`.

### Agregados

- `Appointment`.
- `TransportRequest`.
- `DischargePlan`.

---

## 7. Macrodomínio 6 — Legal / Audit

### Contextos

- `legal-consent` — consentimento informado.
- `legal-audit` — trilha de auditoria.
- `legal-signature` — assinatura ICP-Brasil.
- `legal-retention` — retenção documental.

### Agregados

- `Consent`.
- `AuditRecord` (append-only).
- `SignedDocument`.

### Comandos / Eventos

```
GrantConsent                     ConsentGranted
RevokeConsent                    ConsentRevoked
SignDocument                     DocumentSigned
RecordAuditEntry                 AuditEntryRecorded
```

---

## 8. Macrodomínio 7 — Operations

### Contextos

- `ops-bed-management`.
- `ops-patient-flow`.
- `ops-surgical-scheduling`.
- `ops-or-management`.
- `ops-housekeeping`.
- `ops-command-center`.

### Agregados

- `Bed` (estado: available, occupied, dirty, cleaning, maintenance, blocked).
- `SurgicalCase`.
- `OperatingRoomSession`.
- `HousekeepingTicket`.

### Comandos / Eventos

```
AssignBed                        BedAssigned
ReleaseBed                       BedReleased
StartCleaning                    CleaningStarted
CompleteCleaning                 CleaningCompleted
ScheduleSurgery                  SurgeryScheduled
StartSurgery                     SurgeryStarted
FinishSurgery                    SurgeryFinished
```

---

## 9. Macrodomínio 8 — Supplies / Pharmacy

### Contextos

- `pharmacy-clinical-review`.
- `pharmacy-compounding`.
- `pharmacy-reconciliation`.
- `supplies-inventory`.
- `supplies-procurement`.
- `supplies-traceability`.

### Agregados

- `InventoryItem`.
- `StockMovement`.
- `CompoundingOrder`.
- `ReconciliationCase`.

### Comandos / Eventos

```
ReceiveStock                     StockReceived
MoveStock                        StockMoved
ConsumeStock                     StockConsumed
StartReconciliation              ReconciliationStarted
CompleteReconciliation           ReconciliationCompleted
```

---

## 10. Macrodomínio 9 — Revenue Cycle

### Contextos

- `revenue-registration`.
- `revenue-authorization`.
- `revenue-billing`.
- `revenue-denials`.
- `revenue-accounting`.
- `revenue-costing`.

### Agregados

- `PayerContract`.
- `Authorization`.
- `HospitalAccount` (conta hospitalar).
- `Invoice`.
- `Denial`.

### Comandos / Eventos

```
RegisterPatient                  PatientRegistered
RequestAuthorization             AuthorizationRequested
GrantAuthorization               AuthorizationGranted
PostCharge                       ChargePosted
IssueInvoice                     InvoiceIssued
RecordDenial                     DenialRecorded
SubmitAppeal                     AppealSubmitted
```

---

## 11. Macrodomínio 10 — Access / Roles

### Contextos

- `access-identity` — usuários e sessões.
- `access-rbac` — papéis e escopos.
- `access-abac` — atributos e políticas.
- `access-rebac` — relações paciente-profissional.
- `access-break-glass`.

### Agregados

- `Identity`.
- `Role`.
- `Policy`.
- `BreakGlassSession`.

---

## 12. Macrodomínio 11 — Interoperability

### Contextos

- `interop-fhir`.
- `interop-hl7v2`.
- `interop-dicom`.
- `interop-ihe`.
- `interop-adapters` — conectores específicos (TISS, SUS, laboratórios externos).

### Agregados

- `IntegrationMessage`.
- `TranslationMap`.

---

## 13. Macrodomínio 12 — Mobility

### Contextos

- `mobility-physician`.
- `mobility-nursing`.
- `mobility-bedside`.
- `mobility-command-center`.
- `mobility-patient-portal`.

### Agregados / Read models

- Apps consomem projeções CQRS via tRPC/GraphQL/FHIR REST.

---

## 14. Mapa de integração entre contextos (alto nível)

```
clinical-orders ──(OrderPlaced)──▶ medication-prescription
medication-administration ──(DoseAdministered)──▶ journey-timeline
medication-administration ──(DoseAdministered)──▶ revenue-billing
ops-bed-management ──(BedAssigned)──▶ journey-timeline
revenue-billing ──(ChargePosted)──▶ revenue-accounting
legal-signature ──(DocumentSigned)──▶ legal-audit
pharmacy-reconciliation ──(ReconciliationCompleted)──▶ clinical-orders
```

---

## 15. Regras de fronteira

1. Nenhum contexto lê o DB de outro diretamente.
2. Toda integração assíncrona passa pelo NATS JetStream.
3. Integração síncrona é exceção e requer contrato público versionado.
4. Mudança de schema de evento é aditiva; eventos antigos nunca são editados.
5. Agregados têm dono único; se dois contextos disputam, significa que o modelo está errado.

---

## 16. Referências

- Evans — Domain-Driven Design.
- Vernon — Implementing Domain-Driven Design.
- Fowler — CQRS, Event Sourcing.
- `docs/architecture/velya-hospital-platform-overview.md`
