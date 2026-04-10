# Unificação Clínico + Operacional + Financeiro em Timeline Única do Paciente

> Este documento explica como o Velya Hospital OS elimina os três silos tradicionais
> (clínico, operacional, financeiro) ao projetar tudo como eventos sobre a mesma identidade
> de paciente e sobre o mesmo event store.

---

## 1. O problema dos silos

Hospitais tradicionais operam com três sistemas que raramente se falam em tempo real:

- **Clínico (EHR/HIS)** — prontuário, ordens, resultados, evolução.
- **Operacional (bed management, OR, housekeeping)** — quem está onde, quando e por quê.
- **Financeiro (faturamento, glosas, custos, contabilidade)** — o que custa e o que vai ser
  cobrado.

Em sistemas legados, a conciliação entre os três acontece em lote (noturno), via ETL, com
discrepâncias crônicas: uma medicação administrada que não foi cobrada, um leito ocupado que
não tem conta aberta, uma cirurgia que o faturamento nunca viu. O resultado é glosa,
retrabalho, indicadores defasados e decisões gerenciais cegas.

---

## 2. Tese do Velya — um único stream, três projeções

No Velya, cada evento do paciente é um fato imutável e único, mas gera três projeções
materializadas simultâneas sobre o mesmo event store:

```
                    ┌──────────────────┐
                    │   Event Stream   │
                    │  (patient-id)    │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
  ┌──────┴──────┐    ┌───────┴──────┐    ┌──────┴──────┐
  │  Clinical    │    │ Operational  │    │  Financial   │
  │  projection  │    │  projection  │    │  projection  │
  └─────────────┘    └──────────────┘    └─────────────┘
```

Consequência prática: é **impossível** administrar uma dose sem que a conta hospitalar veja,
e é **impossível** existir um lançamento financeiro sem um evento clínico de origem.

---

## 3. Exemplo concreto — administração de medicamento

Um enfermeiro administra 1g de ceftriaxona à beira-leito. O Velya emite **um único evento**:

```json
{
  "eventType": "medication.administration.administered.v1",
  "eventId": "01HXYZ...",
  "occurredAt": "2026-04-09T14:32:10Z",
  "patientId": "pt-1042",
  "encounterId": "enc-9911",
  "performer": "prof-4421",
  "medication": {
    "code": "CFT1G",
    "dose": { "value": 1, "unit": "g" },
    "route": "IV"
  },
  "source": { "prescriptionId": "rx-3310", "dispensingId": "disp-8876" },
  "billing": { "sigtapCode": "0303010134", "tussCode": "40101010" },
  "cost": { "itemCost": 18.40, "laborMin": 5 }
}
```

Este único evento dispara em paralelo, como projeções:

- **Clínico**: atualização do MAR (Medication Administration Record), linha do tempo do
  paciente, verificação automática de eventos adversos, pontuação de adesão ao protocolo.
- **Operacional**: decremento de estoque do posto, movimentação do inventário, carga de
  trabalho do enfermeiro atualizada, métrica de tempo de administração.
- **Financeiro**: lançamento na conta hospitalar `enc-9911`, geração de pendência de
  cobrança para o convênio, custeio ABC atualizado, KPI de margem em tempo real.

Tudo isso em uma única transação lógica. Se o evento for revertido (erro de administração),
as três projeções revertem juntas.

---

## 4. Identidade única do paciente como pivô

A premissa técnica de unificação é uma identidade de paciente confiável (MPI — Master Patient
Index) usada em todos os contextos:

- `patientId` canônico FHIR é imutável após criação.
- Matching determinístico (CPF, RG, CNS) + probabilístico (nome, data nascimento, mãe) quando
  dados faltam.
- Merge/unmerge auditado — cada fusão de registros é um evento reversível.
- Todos os eventos do stream carregam `patientId` + `encounterId` obrigatórios.

---

## 5. Conta hospitalar como projeção, não entidade primária

Diferente de ERPs hospitalares, a `HospitalAccount` no Velya **não é digitada** pelo
faturamento. Ela é uma projeção materializada construída por regras determinísticas sobre
eventos clínicos e operacionais:

- Cada evento com `billing.*` alimenta a conta.
- O faturista opera sobre a projeção, não sobre o dado primário.
- Correções são comandos que emitem novos eventos (`ChargeCorrected`, `ChargeRemoved`).
- A conta é sempre reconstrutível a partir do zero.

Isso elimina classes inteiras de bugs: conta que "não bate" com o prontuário, cobrança
duplicada, medicação cobrada sem registro de administração.

---

## 6. Custeio ABC em tempo real

O custeio baseado em atividades (Activity-Based Costing) normalmente é um projeto de meses.
No Velya ele é automático:

- Cada evento clínico carrega `cost.itemCost`, `cost.laborMin`, `cost.overheadShare`.
- A projeção `revenue-costing` agrega custos por paciente, por DRG, por médico, por unidade.
- KPIs de margem por linha de cuidado são views materializadas.
- Variação é atribuída ao evento específico que a causou.

---

## 7. Sincronização operacional-clínica

Exemplos de cenários onde a unificação elimina latência/erro:

| Cenário | Silo tradicional | Velya |
|---|---|---|
| Paciente é transferido para UTI | Enfermagem anota, TI roda rotina noturna | Evento `PatientTransferred` atualiza bed-management, journey, billing (diária UTI) na mesma transação |
| Cirurgia termina antes do previsto | Centro cirúrgico avisa, agenda atualiza depois | Evento `SurgeryFinished` libera sala, dispara higienização, atualiza agenda e conta hospitalar |
| Medicação prescrita é suspensa | Prescrição fica ativa no sistema errado | `PrescriptionSuspended` propaga imediatamente para dispensação, administração e cobrança |
| Leito entra em higienização | Status manual em planilha | Evento `CleaningStarted`/`CleaningCompleted` ligado ao ticket de housekeeping |

---

## 8. Impacto em indicadores gerenciais

Porque tudo é evento correlacionado, indicadores deixam de ser "relatórios" e viram queries
sobre o event store:

- Taxa de ocupação **agora**, não fechamento de ontem.
- Margem por especialidade **agora**.
- Tempo médio de permanência por DRG ao vivo.
- Produtividade cirúrgica por sala, por turno, por equipe.
- Consumo de OPME por caso, correlacionado ao resultado clínico.

---

## 9. Garantias transacionais

- **Ordem total por paciente** no event stream (chave de partição = `patientId`).
- **Idempotência** em todos os consumers via `event_id`.
- **Outbox** em serviços que escrevem simultaneamente em DB e NATS.
- **Compensação** via sagas quando um processo longo é abortado.
- **Reprojeção** segura: qualquer projeção pode ser reconstruída em background sem downtime.

---

## 10. Benefícios tangíveis

- Fim da conciliação noturna clínico-financeiro.
- Redução estrutural de glosa (evento-base é auditável).
- Custeio ABC "de graça".
- Indicadores em tempo real sem data warehouse paralelo.
- Auditoria regulatória simplificada (ANVISA, ONA, JCI).
- LGPD — direitos do titular aplicáveis ao stream inteiro.

---

## 11. Limitações e trade-offs honestos

- Event sourcing tem curva de aprendizado maior que CRUD.
- Migração de dados legados exige ingestão cuidadosa e mapeamento semântico.
- Projeções podem divergir temporariamente sob alta carga — é necessário SLO explícito de
  "lag de projeção".
- Dependência forte do event bus: NATS precisa ser operado com rigor (replicação, backups).

---

## 12. Referências

- `docs/architecture/velya-hospital-platform-overview.md`
- `docs/patient-journey/patient-journey-architecture.md`
- `docs/revenue/revenue-cycle-and-finance.md`
- `docs/observability/platform-observability-model.md`
