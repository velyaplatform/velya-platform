# Closed-Loop Medication Management — Arquitetura

> Arquitetura completa do ciclo fechado de medicação do Velya Hospital OS: prescrição,
> revisão farmacêutica, dispensação, preparo, administração beira-leito, reconciliação e
> devolução — tudo sobre um único event stream e com rastreabilidade fim-a-fim.

---

## 1. Tese do Closed-Loop

Um ciclo de medicação é "fechado" quando todo medicamento prescrito tem garantia de que:

1. **Foi clinicamente apropriado** no momento da prescrição (decision support).
2. **Foi validado farmaceuticamente** antes de sair da farmácia.
3. **Foi dispensado** com lote, validade e dose corretos.
4. **Foi preparado** conforme protocolo (quando aplicável).
5. **Foi administrado** ao paciente certo, dose certa, via certa, horário certo, registro certo
   ("cinco certos" digitais).
6. **Teve resposta monitorada** (resultado esperado, evento adverso).
7. **Foi reconciliado** nas transições de cuidado (admissão, transferência, alta).
8. **Foi devolvido** ao estoque se não administrado, com rastreabilidade completa.

No Velya, cada passo é um **evento imutável** no mesmo stream, ligado por `prescription_id`,
`dispensing_id`, `administration_id` e `patient_id`.

---

## 2. Diagrama de fluxo

```
┌───────────────┐   ┌────────────────┐   ┌────────────────┐
│  Prescription │──▶│ Clinical Review│──▶│  Dispensing    │
└───────┬───────┘   └────────────────┘   └────────┬───────┘
        │                                         │
        │                                         ▼
        │                                 ┌──────────────┐
        │                                 │  Compounding │
        │                                 └──────┬───────┘
        │                                        │
        ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│ Reconcile    │◀────────────────────────│ Administration│
└──────────────┘                         └──────┬───────┘
                                                │
                                        ┌───────┴────────┐
                                        │  Monitoring    │
                                        └────────────────┘
```

---

## 3. Eventos do ciclo

| Evento | Emitido por | Principais campos |
|---|---|---|
| `MedicationPrescribed` | clinical-orders | paciente, medicamento, dose, via, frequência, indicação |
| `PrescriptionSafetyChecked` | clinical-safety agent | alergias, interações, dose máxima |
| `PrescriptionReviewed` | pharmacy-clinical-review | farmacêutico, intervenções, status |
| `DispensingOrderCreated` | medication-dispensing | dispensingId, prescriptionId |
| `DoseDispensed` | medication-dispensing | lote, validade, quantidade |
| `DosePrepared` | pharmacy-compounding | protocolo, dupla checagem, foto |
| `DoseAdministered` | medication-administration | executor, via, horário real |
| `AdministrationInterrupted` | medication-administration | motivo |
| `MedicationReactionObserved` | clinical-safety | sintomas, gravidade |
| `DoseReturned` | medication-dispensing | motivo, lote |
| `ReconciliationStarted` | pharmacy-reconciliation | tipo (admissão/transferência/alta) |
| `ReconciliationCompleted` | pharmacy-reconciliation | discrepâncias, decisões |

---

## 4. Validações no momento da prescrição

Antes de aceitar `PrescribeMedication`, o agregado `Prescription` executa um pipeline de
validações síncronas:

- **Alergias** — contra `AllergyIntolerance` do paciente.
- **Interações medicamentosa-medicamento** — base própria + externa (ex.: Micromedex).
- **Interações medicamento-doença** — contra condições ativas.
- **Dose máxima por peso/idade/função renal/função hepática**.
- **Duplicidade terapêutica**.
- **Via incompatível** (ex.: IV em medicamento oral-only).

Cada validação resulta em `PrescriptionSafetyIssue` — severidades `info`, `warning`, `block`.
`block` impede o commit.

---

## 5. Revisão farmacêutica

A fila de revisão é uma projeção priorizada:

- Prioridade por risco clínico (score calculado).
- SLA por prioridade (ex.: P1 = 10 min, P2 = 30 min, P3 = 2 h).
- Cada intervenção farmacêutica é um evento `PharmacyInterventionRecorded` com tipo
  (dose, via, frequência, custo-efetividade, duplicidade).
- Scorecards de farmacêuticos e de médicos (sem exposição nominativa, apenas agregada).

---

## 6. Dispensação e unit dose

- **Unit dose** como padrão — uma dose por embalagem identificada.
- **Código de barras / DataMatrix** em todas as embalagens.
- **Rastreabilidade por lote** — `lotNumber` e `expirationDate` em cada `DoseDispensed`.
- **Armários inteligentes (ADC)** — integração via IHE PCD (Patient Care Devices) e eventos
  diretos; cada abertura e retirada vira evento.
- **Reserva em tempo real** — estoque é decrementado quando a dose é dispensada, não quando
  administrada.

---

## 7. Preparo e compounding

Medicamentos que exigem manipulação (quimioterapia, nutrição parenteral, diluições IV
complexas, pediatria) passam pelo workflow de compounding:

- Protocolo como template versionado.
- Cálculo automático de volume e diluente.
- **Dupla checagem digital** obrigatória — dois farmacêuticos assinam.
- **Fotografia do produto final** como anexo obrigatório.
- **Capela / cabine** identificada no evento.
- **Rastreabilidade de insumos** — cada insumo usado vira `StockConsumed`.

---

## 8. Administração beira-leito — os 5 certos digitais

```
  paciente certo ─── scan pulseira   (patientId)
  medicamento certo ── scan dose     (doseId → prescriptionId)
  dose certa      ─── scan confirma dose (valor e unidade)
  via certa       ─── atributo da dose comparado ao protocolo
  hora certa      ─── janela de aprazamento ± tolerância
  +
  profissional certo ─ scan do crachá (professionalId + papel)
  registro certo  ─── commit atômico do evento `DoseAdministered`
```

Regras:

- Se **qualquer** check falha, a administração não é commitada — é registrada como
  `AdministrationBlocked` com motivo.
- Janela fora de tolerância exige justificativa estruturada.
- Eventos adversos observados dentro de janela configurável são ligados automaticamente
  via `causation.triggeredBy`.

---

## 9. Smart pumps e infusão

- Integração IHE PCD-01 para receber parâmetros de infusão.
- Evento `InfusionStarted` carrega fluxo, concentração, volume.
- Alertas de bomba são eventos (`InfusionAlert`) ligados ao paciente.
- Interrupção de infusão gera `InfusionInterrupted` com motivo.
- Reconciliação de volume real infundido vs. prescrito na `DoseAdministered` final.

---

## 10. Reconciliação medicamentosa

Três momentos obrigatórios:

- **Admissão** — medicamentos em uso domiciliar vs. prescrição hospitalar.
- **Transferência** — entre unidades/setores/níveis de cuidado.
- **Alta** — prescrição de alta vs. medicamentos hospitalares.

Cada caso de reconciliação é um agregado `ReconciliationCase` com estados:
`started -> collecting -> analyzing -> decided -> completed`. Detalhado em
`docs/pharmacy/clinical-pharmacy-and-reconciliation.md`.

---

## 11. Devolução e estoque

- Dose não administrada (paciente recusou, jejum, alta antes do horário) retorna ao estoque
  via `DoseReturned`.
- Políticas de reutilização por tipo de medicamento (termolábeis, controlados, etc).
- Medicamentos controlados exigem dupla assinatura para devolução.
- Devolução de controlados entra em relatório SNGPC automaticamente.

---

## 12. Medicamentos controlados (SNGPC)

- Todo movimento de medicamento controlado dispara evento específico com carimbo para SNGPC.
- Relatório SNGPC é uma projeção determinística do event store.
- Conferência de saldo em tempo real — qualquer divergência gera incidente.

---

## 13. Indicadores do closed-loop

- Tempo médio prescrição -> administração.
- Taxa de intervenções farmacêuticas.
- Taxa de near-miss (blocks e warnings aceitos).
- Taxa de administração fora de janela.
- Discrepâncias de reconciliação por transição.
- Eventos adversos temporalmente correlatos a medicação.

---

## 14. Contratos de interoperabilidade

- **FHIR**: `MedicationRequest`, `MedicationDispense`, `MedicationAdministration`,
  `MedicationStatement`.
- **HL7 v2**: mensagens `RDE^O11`, `RDS^O13`, `RAS^O17` para legado.
- **IHE**: perfis PHARM-H (Pharmacy Hospital), MMA (Medication Management in Acute).

---

## 15. Observabilidade

- Métricas RED por estágio.
- Métrica de tempo de ciclo por dose.
- Alertas de "elo quebrado" — dose dispensada sem administração ou devolução em 24h.
- Dashboards Grafana dedicados ao closed-loop.

---

## 16. Referências

- `docs/pharmacy/clinical-pharmacy-and-reconciliation.md`
- `docs/architecture/domain-map.md`
- `docs/interoperability/fhir-and-event-model.md`
- ISMP Brasil — Práticas seguras de medicação.
- IHE Pharmacy Technical Framework.
