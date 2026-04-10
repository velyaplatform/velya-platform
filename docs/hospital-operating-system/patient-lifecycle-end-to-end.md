# Ciclo de Vida do Paciente — End-to-End

> **Escopo:** da pré-chegada (ambulância, agendamento, walk-in) à alta administrativa (conta quitada, prontuário fechado, follow-up agendado).
> **Unidade de análise:** `encounter` (episódio de cuidado) vinculado a um `patient_id` estável.

---

## 1. Visão Geral das 12 Fases

```
[0] Pré-chegada  →  [1] Chegada  →  [2] Identificação  →  [3] Triagem  →
[4] Espera  →  [5] Atendimento  →  [6] Decisão clínica  →
[7] Diagnóstico/Tratamento  →  [8] Internação (opcional)  →
[9] Permanência  →  [10] Alta clínica  →  [11] Alta administrativa  →
[12] Follow-up / Reinternação
```

Cada fase tem **estado**, **tempo esperado (SLO)**, **atores envolvidos**, **eventos emitidos** e **handoffs de saída**.

---

## 2. Fase 0 — Pré-chegada

**Gatilho:** solicitação externa (SAMU/AMVL, central de regulação, agendamento eletivo, walk-in esperado, transferência inter-hospitalar).

### 2.1 Subcategorias
- **Emergência regulada (SAMU/AMVL):** pré-notificação com ePCR, ETA, queixa principal, idade, sexo, sinais vitais, procedimentos já realizados em cena.
- **Transferência inter-hospitalar:** CCR (central de regulação), OPME se procedimento, aceite do médico receptor.
- **Eletivo agendado:** cirurgia, quimioterapia, exame, consulta. Check-in antecipado, jejum, pré-anestésico.
- **Walk-in esperado:** retorno agendado, telemedicina prévia.

### 2.2 Estado
- `patient.status = PRE_ARRIVAL`
- `encounter.status = EXPECTED`

### 2.3 Tempo esperado
- Pré-notificação EMS → alerta no hospital: ≤ 2 minutos após despacho
- Reserva de leito eletivo: até 24h antes do procedimento
- Pré-autorização convênio: até 72h antes (eletivo)

### 2.4 Atores
- Regulador, despachante, médico regulador, enfermeiro de regulação, recepção, central de leitos, autorizador de convênio.

### 2.5 Handoff de saída
- `HANDOFF: regulation → ED` (ver `ambulance-to-ed-flow.md`)
- `HANDOFF: scheduling → admission` (eletivo)

---

## 3. Fase 1 — Chegada

**Gatilho:** paciente atravessa a porta do hospital (ambulância, walk-in, transporte interno vindo de outro setor).

### 3.1 Estado
- `patient.status = ARRIVED`
- `encounter.status = IN_PROGRESS`
- `location = ENTRANCE | ED_BAY | ADMISSION_DESK`

### 3.2 Tempo esperado
- Porta → Triagem (ED): ≤ 5 minutos (ideal: imediato)
- Chegada eletiva → admissão: ≤ 15 minutos

### 3.3 Eventos emitidos
- `patient.arrived`
- `ems.bay.occupied` (se via ambulância)
- `encounter.opened`

---

## 4. Fase 2 — Identificação e Cadastro

### 4.1 Ações
- Confirmação de identidade (RG, CPF, CNS, biometria, foto).
- Abertura ou recuperação do prontuário.
- Pulseira de identificação (nome completo, DN, nº prontuário, código de barras/RFID).
- Verificação de alergias conhecidas.
- Registro de acompanhante e contato de emergência.
- Plano de saúde / autorização / particular / SUS.

### 4.2 Estado
- `patient.identified = true`
- `encounter.type = EMERGENCY | ELECTIVE_SURGERY | OUTPATIENT | INPATIENT | ONCOLOGY`
- `account.status = OPENED`

### 4.3 Regra de segurança
- **Duas identificações ativas** em todo ponto de cuidado (nunca apenas número do leito).
- **John/Jane Doe** protocol para paciente inconsciente sem documento: identificação provisória com pulseira única + foto.

---

## 5. Fase 3 — Triagem

Detalhada em `triage-and-emergency-flow.md`. Resumo:

### 5.1 Protocolos
- **Manchester Triage System (MTS):** 5 níveis (vermelho, laranja, amarelo, verde, azul).
- **ESI (Emergency Severity Index):** 5 níveis (1 a 5).

### 5.2 Estado
- `patient.status = TRIAGED`
- `triage.level = RED|ORANGE|YELLOW|GREEN|BLUE`
- `triage.reassess_at = now + interval_by_level`

### 5.3 Tempos máximos de atendimento por nível (MTS)
| Nível | Cor | Tempo máximo | Significado |
|---|---|---|---|
| 1 | Vermelho | 0 min (imediato) | Emergente |
| 2 | Laranja | 10 min | Muito urgente |
| 3 | Amarelo | 60 min | Urgente |
| 4 | Verde | 120 min | Pouco urgente |
| 5 | Azul | 240 min | Não urgente |

---

## 6. Fase 4 — Espera

### 6.1 Regra crítica
Pacientes em espera **nunca ficam invisíveis**. O Velya emite `patient.waiting.heartbeat` a cada 5 minutos para manter o estado vivo e dispara `patient.waiting.reassessment_due` conforme o nível de triagem.

### 6.2 Reavaliação obrigatória
- Vermelho: contínuo (não espera)
- Laranja: a cada 10 minutos
- Amarelo: a cada 30 minutos
- Verde: a cada 60 minutos
- Azul: a cada 120 minutos

### 6.3 Dor
Reavaliação de dor (EVA 0-10) a cada 30 min durante a espera. Dor ≥ 7 escala para amarelo.

---

## 7. Fase 5 — Atendimento

### 7.1 Estado
- `patient.status = IN_CARE`
- `care_team.assigned = [md_id, rn_id, ...]`
- `location = CONSULT_ROOM | ED_BAY | EXAM_ROOM | RED_ROOM`

### 7.2 Ações típicas
- Anamnese, exame físico, revisão de medicamentos, reconciliação.
- Solicitação de exames (lab, imagem).
- Prescrição de medicamentos.
- Procedimentos à beira-leito.

---

## 8. Fase 6 — Decisão Clínica

Após resultados de exames e reavaliação, o médico decide:

| Decisão | Próximo estado |
|---|---|
| Alta da emergência | `DISCHARGED_FROM_ED` |
| Observação | `OBSERVATION` (máx 24h) |
| Internação clínica | `ADMISSION_REQUESTED → ADMITTED` |
| Internação UTI | `ICU_REQUESTED → ICU_ADMITTED` |
| Cirurgia urgente | `OR_REQUESTED → IN_OR` |
| Transferência externa | `TRANSFER_REQUESTED → TRANSFERRED` |
| Óbito | `DECEASED` |
| Saída à revelia | `AGAINST_MEDICAL_ADVICE` |

---

## 9. Fase 7 — Diagnóstico e Tratamento

### 9.1 Sub-fluxos
- **Laboratório:** coleta → transporte → processamento → resultado → interpretação → ação.
- **Imagem:** agendamento → preparo → exame → laudo → ação.
- **Farmácia:** prescrição → validação farmacêutica → dispensação → administração → registro → devolução.
- **Procedimentos:** consentimento → preparo → execução → recuperação → registro.

### 9.2 Resultados críticos
Resultado crítico (ex: potássio > 6,5) dispara `critical.result.alert` com:
- Notificação sincrônica ao médico responsável (app, pager, telefone).
- Timer de 30 minutos para acknowledgement.
- Escalação automática se não reconhecido.

---

## 10. Fase 8 — Internação

Ver `inpatient-icu-surgery-oncology-flow.md`.

### 10.1 Etapas
1. Solicitação de internação (médico).
2. Autorização de convênio (se aplicável).
3. Busca de leito pela central de regulação.
4. Reserva do leito.
5. Preparo do leito (higienização terminal, se necessário).
6. Transporte interno.
7. Handoff ED → enfermaria / UTI.
8. Admissão: reconciliação medicamentosa, plano de cuidados, consentimentos.

### 10.2 Estado
- `encounter.status = INPATIENT`
- `bed.status = OCCUPIED`
- `patient.attending_physician = md_id`

---

## 11. Fase 9 — Permanência

### 11.1 Ciclo diário
- Round multiprofissional (médico, enfermagem, fisio, farma, nutri).
- Plano de cuidados atualizado.
- Prescrição revista.
- Exames seriados.
- Reavaliação de risco de queda, úlcera por pressão, TEV, delirium.
- Nutrição.
- Fisioterapia.
- Controle de dor.
- Reavaliação do plano de alta.

### 11.2 Estado
- `los_days = today - admission_date`
- `length_of_stay.expected = f(diagnosis, severity)`
- `discharge.readiness_score = 0..100`

### 11.3 Alertas de permanência
- LOS > esperado → revisão do caso.
- Sem progressão clínica > 48h → comitê.
- Paciente socialmente parado (sem leito externo disponível) → serviço social.

---

## 12. Fase 10 — Alta Clínica

### 12.1 Critérios
- Paciente clinicamente estável.
- Plano de medicamentos em casa definido.
- Exames pendentes resolvidos ou agendados ambulatorialmente.
- Orientações de alta dadas e compreendidas (teach-back).
- Rede de apoio confirmada.
- Transporte definido.

### 12.2 Documentos
- Sumário de alta (discharge summary).
- Receita (Arquivo PEC-PDF assinado digitalmente).
- Solicitações de exames.
- Atestado se aplicável.
- Agendamentos de retorno.
- Orientações por escrito (nível de literacia adequado).

### 12.3 Estado
- `patient.status = DISCHARGE_READY → DISCHARGED`
- `bed.status = DIRTY` (aguardando higienização terminal)

---

## 13. Fase 11 — Alta Administrativa

### 13.1 Ações
- Fechamento da conta.
- Envio ao faturamento.
- Liberação do leito (após higienização terminal).
- Atualização do prontuário eletrônico (fechamento).
- Auditoria de glosa.

### 13.2 Estado
- `account.status = CLOSED_FOR_BILLING`
- `encounter.status = CLOSED`

---

## 14. Fase 12 — Follow-up

### 14.1 Pós-alta imediato (≤ 48h)
- Ligação de follow-up (enfermagem).
- Teach-back sobre medicamentos.
- Reforço de sinais de alarme.
- Confirmação de agendamentos.

### 14.2 Reinternação (monitoramento)
- Reinternação < 30 dias → case review obrigatório.
- Reinternação < 7 dias → comitê de qualidade.

---

## 15. Tempos Globais Esperados (SLOs)

| Métrica | Meta |
|---|---|
| Porta → triagem | ≤ 5 min |
| Triagem → médico (vermelho) | 0 min |
| Triagem → médico (amarelo) | ≤ 60 min |
| Porta → alta (casos simples) | ≤ 4 h |
| Decisão de internação → leito | ≤ 2 h |
| Solicitação ICU → admissão ICU | ≤ 1 h |
| Decisão de cirurgia → sala | ≤ 30 min (urgência) |
| Solicitação de alta → alta administrativa | ≤ 3 h |
| Higienização terminal do leito | ≤ 60 min |

---

## 16. Eventos Emitidos no Ciclo

Cada transição gera um evento no stream `patient.events`:
- `patient.arrived`
- `patient.identified`
- `patient.triaged`
- `patient.waiting`
- `patient.reassessed`
- `patient.in_care`
- `patient.admitted`
- `patient.transferred`
- `patient.discharged`
- `patient.deceased`
- `account.closed`
- `encounter.closed`

Todos os eventos são consumidos pelo dashboard (`command-centers-and-dashboards.md`) e pelo motor de observabilidade (`observability-and-autonomous-improvement.md`).
