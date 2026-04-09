# Padrao de Aceite Explicito de Handoff

> Toda transferencia de responsabilidade requer aceite explicito do receptor. Sem aceite, nao ha transferencia.

## 1. Mandato

Nenhuma responsabilidade e transferida de um profissional para outro sem que o receptor confirme explicitamente o recebimento. O sistema Velya garante que:

1. **Nao existe "handoff implicito"**: A simples troca de turno nao transfere responsabilidade automaticamente — o profissional que sai apresenta, o que entra aceita.
2. **Nao existe "terra de ninguem"**: Em qualquer momento, cada paciente tem exatamente um responsavel identificado por funcao (medico, enfermeiro, tecnico).
3. **Recusa e permitida, mas justificada**: O receptor pode recusar um handoff, mas deve fornecer motivo. O sistema busca alternativa automaticamente.
4. **Timeout gera escalacao**: Se o aceite nao ocorre dentro do prazo, o sistema escala automaticamente.

---

## 2. Timeouts por Prioridade

### 2.1 Tabela de Timeouts

| Prioridade | Timeout para Aceite | Escalacao Nivel 1 | Escalacao Nivel 2 | Escalacao Nivel 3 |
|---|---|---|---|---|
| **Critico** | 5 minutos | Coordenador da unidade receptora (5 min) | Supervisao geral (10 min) | Plantonista backup automatico (15 min) |
| **Urgente** | 15 minutos | Coordenador de enfermagem/medico (15 min) | Supervisao geral (30 min) | Diretoria de plantao (45 min) |
| **Rotina** | 60 minutos | Supervisor do turno (60 min) | Coordenador da unidade (90 min) | Registro como gap + alerta (120 min) |

### 2.2 Criterios de Prioridade

| Prioridade | Criterios |
|---|---|
| **Critico** | Paciente instavel (NEWS2 >= 7), resultado critico pendente, PCR recente, pos-operatorio imediato de cirurgia complexa, isolamento por doenca transmissivel aguda |
| **Urgente** | Paciente com risco moderado (NEWS2 5-6), medicamento de alto risco em andamento, dor nao controlada (>= 7), dispositivo invasivo recente (< 24h), pendencia com SLA proximo |
| **Rotina** | Paciente estavel, sem pendencias criticas, internacao > 48h sem intercorrencias, alta programada |

---

## 3. Fluxo de Handoff Completo

### 3.1 Diagrama ASCII

```
EMISSOR                          SISTEMA                         RECEPTOR
  │                                │                                │
  │  1. Prepara handoff            │                                │
  │  (seleciona pacientes,         │                                │
  │   preenche I-PASS/SBAR)        │                                │
  │                                │                                │
  │────── 2. Envia handoff ──────>│                                │
  │       Task.status=requested    │                                │
  │       + conteudo I-PASS/SBAR   │                                │
  │                                │──── 3. Notifica receptor ────>│
  │                                │     (push + badge + som)       │
  │                                │                                │
  │                                │      ┌─────────────────────┐   │
  │                                │      │ RECEPTOR TEM 3      │   │
  │                                │      │ OPCOES:             │   │
  │                                │      │                     │   │
  │                                │      │ A) ACEITAR          │   │
  │                                │      │ B) RECUSAR + MOTIVO │   │
  │                                │      │ C) NAO RESPONDER    │   │
  │                                │      │    (timeout)        │   │
  │                                │      └─────────────────────┘   │
  │                                │                                │
  │         ┌──────────────────────┼────────────────────────────────┤
  │         │  OPCAO A: ACEITE    │                                │
  │         │                     │<──── 4a. Aceita ──────────────│
  │         │                     │      Task.status=accepted      │
  │         │                     │                                │
  │<── 5a. Confirma aceite ──────│                                │
  │    (notifica emissor)         │                                │
  │                               │──── 6a. Atualiza Digital ────>│
  │    Responsabilidade           │      Twin + CareTeam           │
  │    TRANSFERIDA                │                                │
  │         │                     │                                │
  │         ├──────────────────────┼────────────────────────────────┤
  │         │  OPCAO B: RECUSA   │                                │
  │         │                     │<──── 4b. Recusa + motivo ────│
  │         │                     │      Task.status=rejected      │
  │         │                     │      statusReason=motivo       │
  │         │                     │                                │
  │<── 5b. Notifica recusa ──────│                                │
  │    + motivo                   │                                │
  │                               │──── 6b. Busca alternativa ──>│
  │    Responsabilidade           │      (proximo na lista de      │
  │    PERMANECE com emissor      │       escala)                  │
  │                               │                                │
  │         ├──────────────────────┼────────────────────────────────┤
  │         │  OPCAO C: TIMEOUT  │                                │
  │         │                     │                                │
  │         │                     │  7c. Timer expira              │
  │         │                     │                                │
  │<── 8c. Notifica timeout ─────│                                │
  │                               │──── 9c. ESCALACAO ──────────>│
  │    Responsabilidade           │      Nivel 1: Coordenador      │
  │    PERMANECE com emissor      │      Nivel 2: Supervisao       │
  │    ate resolucao              │      Nivel 3: Backup auto.     │
  │                               │                                │
  └───────────────────────────────┴────────────────────────────────┘
```

### 3.2 Regra Fundamental

**A responsabilidade PERMANECE com o emissor ate que o receptor aceite explicitamente.** O simples envio do handoff NAO transfere responsabilidade. Se o emissor sai do turno sem aceite, a responsabilidade escala para o coordenador da unidade do emissor.

---

## 4. Escalacao por Nao-Aceite

### 4.1 Fluxo de Escalacao

```
┌────────────────┐
│ Handoff enviado│
│ Timer iniciado │
└───────┬────────┘
        │
        │ Timeout expirado
        ▼
┌────────────────────┐     Aceito?     ┌──────────────┐
│ ESCALACAO NIVEL 1  │───── SIM ──────>│ TRANSFERIDO  │
│ Notifica:          │                  └──────────────┘
│ - Receptor (retry) │
│ - Supervisor do    │     NAO (timeout nivel 1)
│   receptor         │──────────────────┐
└────────────────────┘                  │
                                        ▼
                         ┌────────────────────┐     Aceito?
                         │ ESCALACAO NIVEL 2  │───── SIM ──>┌──────────────┐
                         │ Notifica:          │              │ TRANSFERIDO  │
                         │ - Coordenador da   │              └──────────────┘
                         │   unidade receptora│
                         │ - Coordenador da   │     NAO (timeout nivel 2)
                         │   unidade emissora │──────────────────┐
                         └────────────────────┘                  │
                                                                 ▼
                                                  ┌────────────────────┐
                                                  │ ESCALACAO NIVEL 3  │
                                                  │ Acao automatica:   │
                                                  │ - Atribui backup   │
                                                  │ - Registra gap     │
                                                  │ - Notifica diretoria│
                                                  │ - Backup ACEITA    │
                                                  │   automaticamente  │
                                                  └────────────────────┘
```

### 4.2 Notificacoes em Cada Nivel

| Nivel | Canal | Destinatarios | Conteudo |
|---|---|---|---|
| Envio inicial | Push + Badge + Som | Receptor | Resumo do handoff + lista de pacientes |
| Nivel 1 | Push + SMS | Receptor + Supervisor | "Handoff pendente ha {X} min. {N} pacientes sem aceite." |
| Nivel 2 | Push + SMS + Ligacao | Coordenadores | "Handoff critico nao aceito. Paciente {nome} em {unidade}. Intervencao necessaria." |
| Nivel 3 | Todos + Dashboard | Diretoria + Backup | "Handoff nao aceito em {X} min. Backup automatico ativado." |

---

## 5. Recusa com Justificativa

### 5.1 Motivos Padrao de Recusa

| Codigo | Motivo | Acao do Sistema |
|---|---|---|
| `CAPACITY` | "Capacidade excedida — ja com {N} pacientes" | Verifica ratio da unidade, busca alternativa |
| `COMPETENCE` | "Paciente requer competencia que nao possuo" | Busca profissional com competencia adequada |
| `CONFLICT` | "Conflito de interesse (familiar, conhecido)" | Busca alternativa, registra |
| `INCOMPLETE` | "Informacoes insuficientes para aceite seguro" | Solicita complemento ao emissor |
| `WRONG_RECIPIENT` | "Paciente deveria ir para outra unidade/equipe" | Redireciona conforme sugestao |
| `SAFETY` | "Condicoes de seguranca inadequadas (leito, equip.)" | Escala para supervisao operacional |

### 5.2 Regras de Recusa

1. **Justificativa e obrigatoria**: Nao e possivel recusar sem selecionar motivo + texto livre complementar.
2. **Recusa nao transfere**: A responsabilidade permanece com o emissor ate que outro receptor aceite.
3. **Recusa repetida gera alerta**: Se 3 ou mais profissionais recusam o mesmo handoff, gera alerta para coordenacao.
4. **Recusa nao e punitiva**: O sistema registra para analise de fluxo, nao para sancao individual (exceto padrao abusivo).
5. **Limite de recusas**: Mais de 30% de recusas por profissional em 30 dias gera revisao com coordenador.

---

## 6. Formatos Estruturados de Handoff

### 6.1 I-PASS para Handoff Clinico

O formato I-PASS e obrigatorio para handoffs clinicos (medico-medico, enfermeiro-enfermeiro):

| Componente | Descricao | Campos no Sistema |
|---|---|---|
| **I** - Illness Severity | Gravidade: estavel, em observacao, instavel | Dropdown + auto-preenchido pelo NEWS2 |
| **P** - Patient Summary | Resumo: diagnostico principal, historia relevante, plano | Texto livre + auto-sugestao do Twin |
| **A** - Action List | Lista de pendencias e acoes para o proximo turno | Checklist (auto-populado das pendencias do Twin) |
| **S** - Situation Awareness | O que observar: sinais de alerta, limiares, contingencias | Texto livre + alertas ativos do Twin |
| **S** - Synthesis | Confirmacao de entendimento pelo receptor | Checkbox "Entendi e confirmo" + espaco para duvidas |

### 6.2 SBAR para Handoff Operacional

O formato SBAR e usado para acionamentos e escalacoes:

| Componente | Descricao | Exemplo |
|---|---|---|
| **S** - Situation | O que esta acontecendo agora | "Paciente Joao, UTI-A leito 3, SpO2 caindo" |
| **B** - Background | Contexto relevante | "Pos-op D1 de cirurgia abdominal, estava estavel" |
| **A** - Assessment | Avaliacao de quem esta ligando | "Suspeito de TEP, NEWS2 = 8" |
| **R** - Recommendation | O que e necessario | "Preciso avaliacaomedica imediata + angioTC" |

### 6.3 Closed-Loop Communication

Independente do formato, todo handoff segue o principio de closed-loop:

```
EMISSOR:  "Estou transferindo o paciente Joao, UTI-A leito 3, 
           pos-op D1, estavel, NEWS2=2. Pendencias: trocar CVP amanha,
           resultado de cultura pendente."

RECEPTOR: "Recebi. Paciente Joao, UTI-A leito 3, pos-op D1, estavel.
           Pendencias: trocar CVP amanha, cultura pendente. Correto?"

EMISSOR:  "Correto. Transferindo."

RECEPTOR: [ACEITA no sistema]

SISTEMA:  [Registra handoff.accepted, atualiza CareTeam, atualiza Twin]
```

---

## 7. Indicadores Visuais de Handoffs Pendentes

### 7.1 Na Tela do Receptor

| Indicador | Descricao | Condicao |
|---|---|---|
| Badge numerico vermelho | Numero de handoffs pendentes | Qualquer handoff pendente |
| Banner amarelo | "Voce tem {N} handoffs aguardando aceite" | Handoff pendente > 50% do timeout |
| Banner vermelho pulsante | "URGENTE: Handoff critico aguardando aceite" | Handoff critico pendente > 3 min |
| Som de alerta | Notificacao sonora | Handoff critico recebido |
| Modal bloqueante | "Aceite o handoff antes de continuar" | Handoff critico pendente > timeout |

### 7.2 No Dashboard da Unidade

| Indicador | Descricao |
|---|---|
| Semaforo por leito | Verde (com responsavel aceito), Amarelo (handoff pendente), Vermelho (sem responsavel / timeout) |
| Lista de handoffs pendentes | Ordenada por prioridade e tempo de espera |
| Contador de handoffs no turno | Aceitos, pendentes, recusados, escalados |

### 7.3 No Command Center

| Indicador | Descricao |
|---|---|
| Heatmap de handoffs pendentes | Por unidade, colorido por severidade |
| Alerta sonoro | Quando qualquer unidade tem handoff critico em timeout |
| Feed de escalacoes | Lista de handoffs escalados em tempo real |

---

## 8. Tipos de Handoff

### 8.1 Mudanca de Turno (Shift Change)

```
┌─────────────┐                      ┌─────────────┐
│ Enfermeiro A │                      │ Enfermeiro B │
│ (turno dia)  │                      │ (turno noite)│
└──────┬───────┘                      └──────┬───────┘
       │                                      │
       │  15 min antes do fim do turno        │
       │  PREPARA handoff para TODOS          │
       │  os pacientes sob sua resp.          │
       │                                      │
       ├──── Handoff (pacientes 1-6) ────────>│
       │     formato I-PASS                   │
       │     com pendencias auto-populadas    │
       │                                      │
       │<──── Aceite (ou recusa por pac.) ────┤
       │                                      │
       │  Responsabilidade transferida        │
       │  para pacientes aceitos              │
       │                                      │
       │  Para recusados: busca alternativa   │
       │  ou escalacao                        │
```

### 8.2 Cobertura Temporaria (Break)

```
┌─────────────┐                      ┌──────────────┐
│ Enfermeiro A │                      │ Enfermeiro C  │
│ (saindo p/   │                      │ (cobrindo     │
│  almoco)     │                      │  intervalo)   │
└──────┬───────┘                      └──────┬────────┘
       │                                      │
       │  Handoff temporario                  │
       │  (tipo: break_coverage)              │
       │  Duracao esperada: 60 min            │
       │                                      │
       ├──── Handoff (pac. criticos) ────────>│
       │     formato resumido                 │
       │     flag: cobertura_temporaria       │
       │                                      │
       │<──── Aceite ────────────────────────┤
       │                                      │
       │  Apos retorno de A:                  │
       │  C devolve via handoff de retorno    │
       │  com atualizacoes do periodo         │
```

### 8.3 Transferencia entre Unidades

```
┌──────────────┐     ┌────────┐     ┌──────────────┐
│ Enf. UTI     │     │SISTEMA │     │ Enf. Enferm. │
│ (origem)     │     │        │     │ (destino)    │
└──────┬───────┘     └────┬───┘     └──────┬───────┘
       │                  │                 │
       │  Handoff tipo    │                 │
       │  'transfer'      │                 │
       ├── Envia ────────>│                 │
       │   I-PASS completo│                 │
       │   + resumo UTI   │                 │
       │   + dispositivos │                 │
       │   + alertas      │                 │
       │                  ├── Notifica ────>│
       │                  │                 │
       │                  │<── Aceite ─────┤
       │                  │                 │
       │<── Confirma ─────┤                 │
       │                  │                 │
       │  Paciente move   │  Atualiza:      │
       │  fisicamente     │  - Location     │
       │                  │  - CareTeam     │
       │                  │  - Digital Twin │
```

### 8.4 Escalacao

```
┌──────────────┐     ┌────────┐     ┌──────────────┐
│ Enfermeiro   │     │SISTEMA │     │ Medico       │
│              │     │        │     │ Plantonista  │
└──────┬───────┘     └────┬───┘     └──────┬───────┘
       │                  │                 │
       │  Escalacao       │                 │
       │  (SBAR)          │                 │
       ├── Envia ────────>│                 │
       │   Situation      │                 │
       │   Background     │                 │
       │   Assessment     │                 │
       │   Recommendation │                 │
       │                  ├── Notifica ────>│
       │                  │   (alerta       │
       │                  │    prioritario) │
       │                  │                 │
       │                  │<── Aceite ─────┤
       │                  │    + plano de   │
       │                  │    acao         │
       │<── Confirma ─────┤                 │
       │                  │                 │
       │  Registra quem   │                 │
       │  assumiu o caso  │                 │
```

---

## 9. Metricas e Monitoramento

### 9.1 KPIs de Handoff

| Indicador | Meta | Formula |
|---|---|---|
| **Taxa de aceite no SLA** | > 95% | Handoffs aceitos dentro do timeout / Total de handoffs |
| **Tempo medio de aceite** | < 50% do timeout | Media de (aceite.timestamp - envio.timestamp) |
| **Taxa de recusa** | < 10% | Handoffs recusados / Total de handoffs |
| **Taxa de escalacao** | < 5% | Handoffs escalados / Total de handoffs |
| **Completude I-PASS** | > 90% | Handoffs com todos os campos I-PASS preenchidos / Total |
| **Closed-loop confirmado** | > 95% | Handoffs com confirmacao do receptor / Total |
| **Handoffs sem dono** | 0 | Pacientes sem responsavel em qualquer momento |

### 9.2 PromQL

```promql
# Taxa de aceite no SLA
sum by (unit) (rate(velya_handoff_accepted_in_sla_total[24h]))
/ sum by (unit) (rate(velya_handoff_requested_total[24h]))

# Tempo medio de aceite (segundos)
rate(velya_handoff_acceptance_time_seconds_sum[24h])
/ rate(velya_handoff_acceptance_time_seconds_count[24h])

# Escalacoes ativas
sum by (unit) (velya_handoff_escalation_active)

# Handoffs pendentes
sum by (unit, priority) (velya_handoff_pending_count)
```

---

## 10. Implementacao Tecnica

### 10.1 Recurso FHIR: Task (Handoff)

```json
{
  "resourceType": "Task",
  "id": "handoff-12345",
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
  "description": "Handoff de turno - 6 pacientes",
  "focus": {
    "reference": "Encounter/enc-789"
  },
  "for": {
    "reference": "Patient/pat-456"
  },
  "authoredOn": "2026-04-09T18:45:00Z",
  "requester": {
    "reference": "Practitioner/enf-maria",
    "display": "Enf. Maria Santos - COREN 123456/SP"
  },
  "owner": {
    "reference": "Practitioner/enf-joao",
    "display": "Enf. Joao Silva - COREN 789012/SP"
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
            "system": "http://velya.health/handoff-format",
            "code": "ipass"
          }
        ]
      },
      "valueString": "{\"illnessSeverity\":\"stable\",\"patientSummary\":\"Pos-op D2...\",\"actionList\":[\"Trocar CVP\",\"Aguardar cultura\"],\"situationAwareness\":\"Monitorar debito dreno\",\"synthesis\":\"\"}"
    }
  ]
}
```

### 10.2 Evento Kafka

```json
{
  "eventId": "evt-handoff-67890",
  "eventType": "handoff.requested",
  "timestamp": "2026-04-09T18:45:00.123456Z",
  "patientId": "pat-456",
  "encounterId": "enc-789",
  "from": "Practitioner/enf-maria",
  "to": "Practitioner/enf-joao",
  "priority": "urgent",
  "timeoutAt": "2026-04-09T19:00:00Z",
  "handoffType": "shift_change",
  "format": "ipass",
  "patientCount": 1,
  "taskReference": "Task/handoff-12345"
}
```

---

## 11. Cenarios de Excecao

### 11.1 Emissor sai antes do aceite

Se o profissional que emitiu o handoff encerra sessao/sai do hospital antes do aceite:
1. O sistema registra `shift.ended` para o emissor.
2. A responsabilidade e transferida automaticamente para o coordenador da unidade.
3. O coordenador recebe notificacao critica: "Profissional saiu com handoff pendente."
4. Incidente e registrado para revisao pelo RH.

### 11.2 Receptor indisponivel (emergencia)

Se o receptor designado esta atendendo emergencia:
1. O receptor pode marcar status "em emergencia" no sistema.
2. O sistema busca automaticamente o proximo profissional disponivel na escala.
3. O handoff e redirecionado sem penalizar o receptor original.

### 11.3 Multiplos pacientes

Em handoffs de turno com multiplos pacientes:
1. O receptor pode aceitar pacientes individualmente.
2. Pacientes recusados sao redirecionados individualmente.
3. O aceite parcial e registrado — o emissor permanece responsavel pelos nao aceitos.

### 11.4 Sistema fora do ar

Se o sistema Velya estiver indisponivel:
1. Handoff verbal e realizado com formulario impresso (contingencia).
2. Ao retornar, ambos profissionais registram o handoff retroativamente (com justificativa "sistema indisponivel").
3. O sistema aceita registro retroativo com flag `contingency_mode`.
