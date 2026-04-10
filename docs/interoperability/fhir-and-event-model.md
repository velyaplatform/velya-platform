# FHIR R4 e Modelo de Eventos — Backbone de Interoperabilidade

> Arquitetura de interoperabilidade do Velya Hospital OS: FHIR R4 como linguagem canônica
> clínica, NATS JetStream como event bus, HL7 v2 para legado, DICOMweb para imagem e perfis
> IHE para interoperabilidade entre sistemas.

---

## 1. Visão geral

O Velya adota um modelo híbrido:

- **Interno**: eventos + agregados com shape FHIR canônico, comunicação via NATS JetStream.
- **Externo inbound**: conectores para HL7 v2 (legado), FHIR R4 REST (moderno), DICOM/DICOMweb
  (imagem), APIs específicas (TISS, CNES, SUS).
- **Externo outbound**: APIs FHIR R4 públicas versionadas, XML TISS, HL7 v2, DICOMweb.

```
 ┌─────────────┐       ┌───────────────┐       ┌───────────────┐
 │ External    │       │  Interop      │       │  Internal     │
 │ systems     │◀─────▶│  adapters     │◀─────▶│  domain buses │
 │ (LIS/RIS/.. )│       │  (mappers)    │       │  (NATS JS)    │
 └─────────────┘       └───────────────┘       └───────────────┘
```

---

## 2. Por que FHIR R4 como canônico

- **Padrão global** da HL7 para interoperabilidade em saúde.
- **Recursos ricos** cobrindo clínico, administrativo e financeiro.
- **Extensibilidade** via `Extension` para particularidades brasileiras.
- **Perfis** permitem validação estrita sem sair do padrão.
- **APIs REST/JSON** naturalmente modernas.
- **Search** padrão elimina APIs ad-hoc.

---

## 3. Recursos FHIR centrais usados

| Domínio | Recursos |
|---|---|
| Identidade | `Patient`, `Practitioner`, `PractitionerRole`, `Organization`, `Location` |
| Atendimento | `Encounter`, `EpisodeOfCare`, `Appointment`, `CareTeam`, `CarePlan` |
| Clínico | `Observation`, `Condition`, `Procedure`, `AllergyIntolerance`, `FamilyMemberHistory` |
| Diagnóstico | `ServiceRequest`, `DiagnosticReport`, `ImagingStudy`, `Specimen` |
| Medicação | `MedicationRequest`, `MedicationDispense`, `MedicationAdministration`, `MedicationStatement`, `Medication` |
| Documento | `DocumentReference`, `Composition`, `Binary` |
| Financeiro | `Coverage`, `Claim`, `ExplanationOfBenefit`, `ChargeItem`, `Invoice` |
| Tarefas | `Task`, `Questionnaire`, `QuestionnaireResponse` |
| Consentimento | `Consent`, `Provenance` |

---

## 4. Perfis brasileiros

Perfis próprios sob o namespace `http://velya.health/fhir/StructureDefinition/`:

- `BRPatient` — extensão com CPF, CNS, RG, raça/cor IBGE.
- `BRPractitioner` — conselho, UF, número, especialidade CBO.
- `BRCoverage` — plano ANS, registro da operadora.
- `BRMedication` — registro ANVISA, código EAN/DataMatrix.
- `BRProcedure` — códigos TUSS, SIGTAP, CBHPM.

Perfis são validados automaticamente na ingestão e na exposição via FHIR API.

---

## 5. Eventos como backbone

### 5.1. NATS JetStream

- **Streams por domínio** (`clinical.*`, `medication.*`, `operations.*`, `revenue.*`,
  `interop.*`).
- **Subjects** no formato `<domain>.<aggregate>.<event>.v<version>`.
- **Durabilidade**: `File` storage com replicação 3.
- **Retention**: por stream, mínimo 30 dias + sink para event store persistente.
- **Consumers** durable por projeção.
- **Idempotência** por `event_id` + `dedup_window`.

### 5.2. Envelope de evento (resumo)

```json
{
  "eventId": "01HXYZ...",
  "eventType": "medication.administration.administered.v1",
  "occurredAt": "2026-04-09T14:32:10Z",
  "recordedAt": "2026-04-09T14:32:10.231Z",
  "tenantId": "hosp-abc",
  "patientId": "pt-1042",
  "payload": { "...": "..." },
  "causation": { "commandId": "cmd-..." },
  "correlation": { "traceId": "..." },
  "schemaVersion": 1
}
```

---

## 6. Estratégia de versionamento de eventos

- Cada evento tem versão no subject (`...administered.v1`).
- Consumers podem se inscrever em versões específicas.
- Mudanças aditivas (campo opcional) não bumpam versão.
- Mudanças quebra-schema bumpam versão e vivem lado a lado.
- Upcasters podem transformar v1 -> v2 em read models quando conveniente.

---

## 7. HL7 v2 para legado

Adapter `interop-hl7v2` recebe/envia mensagens HL7 v2.x via MLLP ou HTTPS:

- Perfis mais usados: `ADT^A01/A03/A08`, `ORU^R01`, `ORM^O01`, `RDE^O11`, `RDS^O13`,
  `MDM^T02`.
- **Tradução** para eventos internos via mappers declarativos.
- **Caixa de entrada imutável** — a mensagem original é armazenada como blob assinado.
- **DLQ** para mensagens inválidas com ferramenta de replay.
- **Acknowledgments** (`ACK`/`NACK`) com semântica clara.

---

## 8. DICOM e DICOMweb

- **DICOMweb** como padrão moderno: QIDO-RS, WADO-RS, STOW-RS.
- Integração com PACS institucional via proxy.
- Metadados DICOM espelhados em `ImagingStudy` FHIR.
- Laudos como `DiagnosticReport` com referência a `ImagingStudy`.
- Viewer web integrado ao portal clínico.

---

## 9. Perfis IHE

O Velya adere a perfis IHE aplicáveis:

- **PIX / PDQ** — Patient Identifier Cross-Reference / Patient Demographics Query.
- **XDS.b** — compartilhamento de documentos.
- **ATNA** — auditoria e segurança em rede.
- **BPPC** — consentimento.
- **PCD-01** — comunicação com dispositivos beira-leito (bombas, monitores).
- **PHARM-H, MMA** — medicação hospitalar.
- **SWF** — scheduled workflow (radiologia).

---

## 10. APIs RESTful tipadas

- **FHIR API** pública sob `/fhir/R4/...` com validação estrita.
- **tRPC** interno para comunicação entre serviços e frontend, com tipos compartilhados.
- **GraphQL** opcional para mobile, exposto sobre as mesmas projeções CQRS.
- **Contratos versionados** via OpenAPI 3.1 + FHIR Capability Statement.
- **Rate limiting**, **quota por tenant** e **audit** no gateway.

---

## 11. Segurança da interoperabilidade

- **SMART on FHIR** suportado para apps de terceiros.
- **OAuth 2.1** obrigatório em APIs externas.
- **Scopes FHIR** (`patient/*.read`, `user/*.write`).
- **Consent** FHIR avaliado em cada requisição sensível.
- **mTLS** para integrações servidor-servidor.
- **Logs ATNA** para cada acesso externo.

---

## 12. Ingestão e saída — contratos explícitos

Toda integração externa tem:

- Contrato documentado (OpenAPI / HL7 spec / DICOM conformance).
- Owner técnico no Velya.
- SLA definido.
- Mapeamento de erros.
- DLQ e replay.
- Dashboard de monitoramento.
- Testes contratuais automáticos em CI.

---

## 13. Mapeamento evento -> FHIR

Cada evento interno tem um mapper declarativo para recursos FHIR quando exposto
externamente. Exemplo:

```yaml
event: medication.administration.administered.v1
produces:
  - resource: MedicationAdministration
    fields:
      status: "completed"
      subject: "Patient/{{patientId}}"
      effectiveDateTime: "{{occurredAt}}"
      performer:
        - actor: "Practitioner/{{performer}}"
      dosage:
        dose:
          value: "{{medication.dose.value}}"
          unit: "{{medication.dose.unit}}"
        route:
          coding:
            - system: "http://snomed.info/sct"
              code: "{{medication.route.snomed}}"
```

---

## 14. Observabilidade específica

- `interop_message_received_total{type="HL7v2", msgType="ADT^A01"}`
- `interop_message_translated_duration_ms`
- `interop_dlq_depth`
- `fhir_validation_failures_total{profile="..."}`
- Traces desde a mensagem externa até o commit do evento interno.

---

## 15. Testes de conformidade

- Suite de testes contra fixtures HL7 v2, FHIR e DICOM.
- Testes de round-trip: evento interno -> FHIR -> ingestão -> mesmo evento reconstruído.
- Fuzz testing em campos FHIR.
- CI com validador oficial FHIR.

---

## 16. Referências

- HL7 FHIR R4 — https://www.hl7.org/fhir/R4/
- IHE Profiles — https://www.ihe.net/
- SMART on FHIR — https://hl7.org/fhir/smart-app-launch/
- DICOMweb — https://www.dicomstandard.org/dicomweb
- `docs/architecture/velya-hospital-platform-overview.md`
- `docs/patient-journey/patient-journey-architecture.md`
