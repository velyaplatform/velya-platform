# Modelo de Status do Paciente e Máquinas de Estado de Recursos

> **Escopo:** modelo formal dos estados de um paciente no hospital e dos recursos (leitos, salas, equipamentos, contas), transições válidas, eventos disparadores e regras de bloqueio.

---

## 1. Princípio

Tudo no hospital é uma **máquina de estado**. Paciente não é "aberto"/"fechado". É `TRIAGED`, `WAITING`, `IN_CARE`, `BOARDING`, `ADMITTED`, `IN_OR`, `PACU`, `ICU`, `DISCHARGE_READY`, `DISCHARGED`, `CLOSED`. Cada estado tem pré-condições, transições válidas e eventos esperados.

Estados são **explícitos**. Transições são **auditadas**. Nunca há "estado implícito".

---

## 2. Máquina de Estado do Paciente (Encounter)

### 2.1 Estados (25+)

#### Pré-chegada
1. `EXPECTED` — paciente esperado (agendamento ou regulação).
2. `EN_ROUTE` — em transporte para o hospital (ambulância).

#### Chegada e triagem
3. `ARRIVED` — cruzou a porta.
4. `REGISTERED` — cadastro concluído, pulseira colocada.
5. `TRIAGED` — triagem feita, nível atribuído.

#### Espera e atendimento
6. `WAITING` — aguardando atendimento.
7. `IN_CARE` — sendo atendido por equipe.
8. `UNDER_INVESTIGATION` — exames em curso.
9. `IN_PROCEDURE` — procedimento à beira-leito ou em sala.

#### Observação e decisão
10. `OBSERVATION` — em observação na ED (até 24h).
11. `AWAITING_DISPOSITION` — decisão pendente.

#### Internação
12. `ADMISSION_REQUESTED` — ordem de internação emitida.
13. `AWAITING_BED` — esperando leito.
14. `BOARDING` — admitido mas ainda na ED.
15. `IN_TRANSPORT` — sendo movido.
16. `ADMITTED` — em leito de internação comum.
17. `ICU_ADMITTED` — em UTI.
18. `SEMI_ADMITTED` — em unidade semi-intensiva.
19. `IN_OR` — em centro cirúrgico.
20. `PACU` — recuperação pós-anestésica.

#### Permanência e transferências
21. `IN_TREATMENT` — tratamento em curso.
22. `ON_LEAVE` — saída temporária (raro, com autorização).
23. `TRANSFERRED_INTERNAL` — mudou de unidade interna.
24. `TRANSFER_OUT_REQUESTED` — transferência externa solicitada.
25. `TRANSFERRED_OUT` — transferido para outro hospital.

#### Alta e fim
26. `DISCHARGE_READY` — clinicamente pronto para alta.
27. `DISCHARGE_IN_PROGRESS` — papelada e orientações.
28. `DISCHARGED` — fisicamente saiu do hospital.
29. `AGAINST_MEDICAL_ADVICE` — alta a pedido.
30. `DECEASED` — óbito.
31. `CLOSED` — encounter administrativamente fechado.

### 2.2 Transições válidas (exemplos)

| De | Para | Gatilho |
|---|---|---|
| `EXPECTED` | `EN_ROUTE` | despacho da ambulância |
| `EN_ROUTE` | `ARRIVED` | GPS/porta + sensor |
| `ARRIVED` | `REGISTERED` | cadastro concluído |
| `REGISTERED` | `TRIAGED` | triagem finalizada |
| `TRIAGED` | `WAITING` | aguardando médico |
| `TRIAGED` | `IN_CARE` | médico já disponível |
| `WAITING` | `IN_CARE` | chamada do médico |
| `IN_CARE` | `UNDER_INVESTIGATION` | solicitação de exames |
| `IN_CARE` | `OBSERVATION` | decisão de observar |
| `IN_CARE` | `ADMISSION_REQUESTED` | decisão de internar |
| `IN_CARE` | `DISCHARGED` | alta direta da ED |
| `IN_CARE` | `DECEASED` | óbito |
| `ADMISSION_REQUESTED` | `AWAITING_BED` | autorização ok, sem leito |
| `AWAITING_BED` | `BOARDING` | autorização ok, ainda na ED |
| `BOARDING` | `IN_TRANSPORT` | leito pronto, maqueiro chegou |
| `IN_TRANSPORT` | `ADMITTED` | handoff na unidade |
| `ADMITTED` | `ICU_ADMITTED` | deterioração, transferência |
| `ICU_ADMITTED` | `ADMITTED` | melhora, step-down |
| `ADMITTED` | `IN_OR` | cirurgia programada |
| `IN_OR` | `PACU` | fim da cirurgia |
| `PACU` | `ADMITTED` | critérios de alta da RPA |
| `PACU` | `ICU_ADMITTED` | pós-op complicado |
| `ADMITTED` | `DISCHARGE_READY` | critérios atingidos |
| `DISCHARGE_READY` | `DISCHARGE_IN_PROGRESS` | início do processo |
| `DISCHARGE_IN_PROGRESS` | `DISCHARGED` | saída física |
| `DISCHARGED` | `CLOSED` | conta fechada |
| qualquer | `DECEASED` | óbito |
| qualquer (exceto `CLOSED`, `DECEASED`) | `AGAINST_MEDICAL_ADVICE` | saída a pedido |

### 2.3 Transições proibidas
- Não se volta de `DECEASED` a qualquer outro estado.
- Não se vai de `EXPECTED` direto para `ADMITTED` sem passar por chegada, registro, decisão.
- Não se vai de `WAITING` direto para `DISCHARGED` sem `IN_CARE`.

### 2.4 Eventos emitidos em cada transição
```
patient.state.changed {
  patient_id,
  encounter_id,
  from,
  to,
  by (user_id),
  at,
  reason,
  trace_id
}
```

### 2.5 Regras de bloqueio
- Não pode ir para `DISCHARGED` sem prescrição de alta assinada.
- Não pode ir para `ICU_ADMITTED` sem leito UTI reservado + intensivista notificado.
- Não pode ir para `IN_OR` sem sign-in completo.
- Não pode ir para `CLOSED` sem conta enviada.

---

## 3. Máquina de Estado do Leito

### 3.1 Estados
- `AVAILABLE_CLEAN` — pronto para ocupação.
- `RESERVED` — reservado para paciente específico.
- `OCCUPIED` — em uso.
- `DISCHARGE_IN_PROGRESS` — saída do paciente em curso.
- `DIRTY` — precisa de higienização terminal.
- `CLEANING_IN_PROGRESS` — higienização em andamento.
- `INSPECTING` — inspeção de qualidade.
- `MAINTENANCE` — em manutenção.
- `BLOCKED` — bloqueado (quarentena, reforma, etc.).
- `RETIRED` — fora de uso definitivo.

### 3.2 Transições
- `AVAILABLE_CLEAN` → `RESERVED` → `OCCUPIED` → `DISCHARGE_IN_PROGRESS` → `DIRTY` → `CLEANING_IN_PROGRESS` → `INSPECTING` → `AVAILABLE_CLEAN`
- Qualquer estado → `MAINTENANCE` → `AVAILABLE_CLEAN`
- Qualquer estado → `BLOCKED` → `AVAILABLE_CLEAN`

---

## 4. Máquina de Estado da Sala Cirúrgica

### 4.1 Estados
- `AVAILABLE`
- `SCHEDULED`
- `SETUP_IN_PROGRESS`
- `READY`
- `IN_SURGERY`
- `CLOSING`
- `CLEANING`
- `TURNAROUND`
- `BLOCKED`
- `MAINTENANCE`

### 4.2 Métricas derivadas
- First case on-time start.
- Turnaround time = `CLEANING` + `SETUP_IN_PROGRESS`.
- Utilização = `IN_SURGERY` / disponibilidade planejada.

---

## 5. Máquina de Estado do Equipamento

### 5.1 Estados
- `AVAILABLE`
- `IN_USE`
- `DIRTY`
- `CLEANING`
- `MAINTENANCE_PREVENTIVE`
- `MAINTENANCE_CORRECTIVE`
- `AWAITING_PARTS`
- `CALIBRATION_DUE`
- `BLOCKED`
- `RETIRED`

### 5.2 Regra crítica
Equipamento com `CALIBRATION_DUE` não pode ir para `IN_USE`.

---

## 6. Máquina de Estado da Conta

### 6.1 Estados
- `REGISTERED`
- `OPEN`
- `PENDING_AUTHORIZATION`
- `AUTHORIZED`
- `IN_SERVICE`
- `READY_TO_CLOSE`
- `CLOSED_FOR_BILLING`
- `SENT_TO_PAYER`
- `IN_ANALYSIS`
- `GLOSSED`
- `UNDER_APPEAL`
- `PARTIALLY_PAID`
- `PAID`
- `WRITTEN_OFF`

---

## 7. Máquina de Estado do Instrumental

### 7.1 Estados
- `CLEAN_STORED`
- `RESERVED_FOR_CASE`
- `ISSUED_TO_OR`
- `IN_USE`
- `DIRTY_RETURNED`
- `WASHING`
- `INSPECTION`
- `ASSEMBLY`
- `PACKAGED`
- `STERILIZING`
- `QUARANTINE`
- `RELEASED`
- `CLEAN_STORED` (ciclo completo)
- `MAINTENANCE`
- `RETIRED`

---

## 8. Máquina de Estado da Solicitação de Exame

- `ORDERED`
- `COLLECTED` (lab) / `SCHEDULED` (imagem)
- `IN_PROCESSING`
- `TECHNICALLY_VALIDATED`
- `CLINICALLY_VALIDATED`
- `RESULTED`
- `CRITICAL_RESULT` (fork)
- `ACKNOWLEDGED`
- `ACTED_UPON`
- `CANCELED`

---

## 9. Máquina de Estado da Prescrição Medicamentosa

- `DRAFT`
- `SIGNED`
- `PHARMACIST_VALIDATED`
- `DISPENSED`
- `DELIVERED_TO_UNIT`
- `DUE`
- `ADMINISTERED`
- `NOT_ADMINISTERED` (com motivo)
- `RETURNED`
- `SUSPENDED`
- `DISCONTINUED`

---

## 10. Relação Entre Máquinas

Máquinas se **influenciam**:
- `patient.state = DISCHARGED` ⇒ `bed.state = DIRTY` (automático).
- `bed.state = AVAILABLE_CLEAN` ⇒ desbloqueio da próxima reserva.
- `exam.state = CRITICAL_RESULT` ⇒ alerta para `patient.care_team`.
- `equipment.state = CALIBRATION_DUE` ⇒ bloqueio no agendamento cirúrgico.
- `account.state = GLOSSED` ⇒ task para `billing.analyst`.

Essas conexões são explícitas em `choreography.yaml`, não escondidas em código.

---

## 11. Auditoria de Estados

Toda transição é persistida:
- Quem (ator)
- Quando (timestamp)
- De onde (estado anterior)
- Para onde (estado novo)
- Por quê (motivo)
- Trace ID

A ausência de transições em tempo hábil é também um sinal: um paciente em `BOARDING` por > 4h dispara alerta; um leito `DIRTY` por > 2h dispara alerta.

---

## 12. Uso em Dashboards

Dashboards (ver `command-centers-and-dashboards.md`) são construídos **consumindo estados**:
- Contagem de pacientes por estado.
- Distribuição temporal (histograma de tempo em cada estado).
- SLOs por transição.
- Gargalos visuais.
