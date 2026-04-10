# Bed Management, Patient Flow e Scheduling Cirúrgico

> Arquitetura do domínio operacional do Velya Hospital OS: gestão de leitos, fluxo do
> paciente, boarding, transferências, agendamento cirúrgico, gestão de salas e equipes.

---

## 1. Escopo

Este documento cobre os bounded contexts:

- `ops-bed-management` — estado de leitos e ocupação.
- `ops-patient-flow` — movimentação do paciente pelo hospital.
- `ops-housekeeping` — higienização e manutenção.
- `ops-surgical-scheduling` — agendamento cirúrgico multi-restrição.
- `ops-or-management` — gestão do centro cirúrgico.
- `ops-command-center` — painel operacional unificado.

---

## 2. Modelo do leito

Um leito é um agregado com máquina de estados formal:

```
 available ──occupy──▶ occupied ──discharge──▶ dirty
    ▲                                            │
    │                                         clean
    │                                            │
    └───────────────── cleaning ◀────────────────┘
                          │
                    maintenance
                          │
                       blocked
```

### Estados

| Estado | Significado |
|---|---|
| `available` | Pronto para ocupar |
| `reserved` | Reservado para paciente específico |
| `occupied` | Paciente atribuído |
| `dirty` | Alta realizada, aguardando higienização |
| `cleaning` | Higienização em andamento |
| `maintenance` | Manutenção técnica |
| `blocked` | Bloqueado por decisão gerencial (isolamento, obra, etc.) |

### Atributos

```ts
interface Bed {
  id: string;
  unitId: string;
  roomId: string;
  number: string;
  type: 'standard' | 'uti' | 'semi-uti' | 'isolation' | 'bariatric' | 'pediatric' | 'obstetric';
  features: string[];     // oxigênio, monitor, ventilador, etc.
  isolationCapable: boolean;
  currentState: BedState;
  stateSince: Date;
  lastCleanedAt?: Date;
  nextMaintenanceDue?: Date;
}
```

---

## 3. Eventos

```
BedCreated
BedAttributesUpdated
BedReserved            (reservado para patientId)
BedOccupied            (ocupado por patientId)
BedReleased            (alta emitida; leito vira dirty)
CleaningStarted
CleaningCompleted
MaintenanceScheduled
MaintenanceStarted
MaintenanceCompleted
BedBlocked / BedUnblocked
```

---

## 4. Patient Flow

Fluxo do paciente é uma projeção sobre eventos de bed-management + clinical-encounter:

- Admissão -> alocação de leito -> internação -> transferências -> alta.
- Cada transferência é um evento `PatientTransferred` com `fromBedId` e `toBedId`.
- Transferências dentro do mesmo encounter preservam a história.
- Boarding (paciente aguardando leito em emergência) é estado explícito.

### Indicadores de fluxo

- **LOS** — Length of Stay por paciente / por DRG / por unidade.
- **Boarding time** — tempo entre decisão de internar e alocação de leito.
- **Bed turnover time** — tempo entre alta e próxima ocupação.
- **Cleaning time** — tempo entre dirty e available.
- **Occupancy rate** por unidade em tempo real.

---

## 5. Housekeeping

- Ticket de higienização é um agregado com SLA.
- Criado automaticamente quando leito entra em `dirty`.
- Atribuído à equipe de limpeza via fila priorizada.
- Mobile app da equipe de limpeza:
  - Recebe push com o ticket.
  - Scan do QR do leito para iniciar.
  - Checklist por tipo de higienização (concorrente, terminal, isolamento).
  - Foto final obrigatória em limpeza terminal.
  - Scan final para concluir.
- SLA parametrizável por prioridade e por tipo de leito.
- Métricas de produtividade por equipe e por turno.

---

## 6. Agendamento cirúrgico

Problema: alocar cirurgias em um conjunto de salas respeitando múltiplas restrições ao mesmo
tempo:

- **Sala** disponível e com os equipamentos requeridos.
- **Equipe cirúrgica** (cirurgião, auxiliar, instrumentador, anestesista) disponível e
  habilitada.
- **Material/OPME** reservado e disponível na data.
- **Leito de origem e destino** — em especial, leito de UTI pós-op quando necessário.
- **Banco de sangue** — reserva quando solicitada.
- **Autorização do convênio** válida.
- **Preparos pré-operatórios** concluídos (exames, medicação, jejum).
- **Tempo de setup e turnaround** da sala.

### Agregado `SurgicalCase`

```ts
interface SurgicalCase {
  id: string;
  patientId: string;
  procedureCodes: string[];      // TUSS/SIGTAP
  surgeonId: string;
  assistants: string[];
  anesthesiaType: 'general' | 'regional' | 'local' | 'sedation';
  anesthesiologistId: string;
  requiredFeatures: string[];
  estimatedDurationMin: number;
  priority: 'emergency' | 'urgent' | 'elective';
  requiredMaterials: MaterialRequirement[];
  requiresIcuBed: boolean;
  bloodReservation?: BloodReservation;
  authorizationId?: string;
  state: CaseState;
  scheduledAt?: Date;
  roomId?: string;
}
```

### Estados

```
requested -> authorized -> materials_reserved -> team_assigned -> scheduled
-> in_preop -> in_surgery -> in_recovery -> completed
                                          \
                                           -> cancelled (com motivo)
```

### Otimizador

Serviço `surgery-scheduler` resolve a alocação como problema de otimização (ILP / CP-SAT):

- Objetivo: maximizar utilização de sala minimizando atraso e desbalanceamento.
- Restrições duras: disponibilidade, autorização, material, equipe.
- Restrições moles: preferência do cirurgião, minimizar trocas de cirurgião no mesmo dia.
- Re-otimização incremental quando cancelamento acontece.

---

## 7. Gestão do centro cirúrgico

- Timeline completa da cirurgia:
  - Chegada ao pré-op.
  - Entrada na sala.
  - Início da anestesia.
  - Incisão.
  - Fim da cirurgia.
  - Saída da sala.
  - Chegada à RPA.
- Cada marco é um evento linkado ao `SurgicalCase`.
- Checklist de cirurgia segura da OMS como formulário estruturado obrigatório.
- Contagem de compressas, fios e instrumentos como evento (dupla checagem).
- Consumo de OPME registrado em tempo real via scan.

---

## 8. Escalas e equipes

Bounded context `workforce/scheduling`:

- Perfis profissionais com competências versionadas.
- Escalas respeitando CLT, CFM, COREN (ex.: limite de plantões).
- Troca de plantão como processo com aprovação.
- Integração com ponto eletrônico.
- Métricas de overtime e fadiga.

---

## 9. Command Center

Painel unificado que combina projeções operacionais em tempo real:

- Mapa do hospital com status dos leitos.
- Fila de boarding em emergência.
- Lista de cirurgias em andamento com timeline.
- Tempo médio de alta do dia.
- Previsão de alta das próximas 24h.
- Ocupação por unidade com projeção de ocupação pela próxima hora.
- Incidentes ativos.

Construído sobre métricas OpenTelemetry + projeções CQRS.

---

## 10. Previsão operacional (opcional / roadmap)

Agents podem:

- Prever horário de alta com base em histórico + evolução clínica.
- Prever demanda de leito por unidade.
- Sugerir remanejamento para reduzir boarding.
- Detectar gargalos de fluxo.

Sempre em modo supervisionado (ver governança de agents).

---

## 11. Métricas

- Occupancy rate (real-time).
- ALOS (Average Length of Stay).
- Bed turnover.
- Boarding time.
- Surgical utilization %.
- First-case on-time start.
- Turnover time entre cirurgias.
- Cancellation rate.
- Housekeeping SLA compliance.

---

## 12. Integrações

- **ERP** para OPME e custos.
- **Convênios** para autorizações.
- **RFID/IoT** para rastreamento de ativos e equipes (opcional).
- **Ponto eletrônico** para escalas.

---

## 13. Segurança e auditoria

- Transições de leito auditadas com responsável.
- Bloqueio de leito exige justificativa e aprovação.
- Alterações de agenda cirúrgica versionadas.
- Acesso a dados de escalas controlado.

---

## 14. Referências

- `docs/architecture/domain-map.md`
- `docs/architecture/clinical-operational-financial-unification.md`
- `docs/observability/platform-observability-model.md`
- ISBAR/SBAR — passagem de plantão.
- Lista de verificação de segurança cirúrgica (OMS).
