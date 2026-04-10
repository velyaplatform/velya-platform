# Observabilidade Clínica e Melhoria Autônoma

> **Escopo:** como o Velya monitora a si mesmo e aos fluxos clínicos, detecta fluxos quebrados, aprende com erros e aciona agentes autônomos de melhoria contínua.

---

## 1. Princípio

Um hospital é um sistema distribuído em tempo real. Tratar observabilidade como "bônus de DevOps" é um erro. No Velya, **observabilidade clínica é parte do contrato do sistema**: se uma fase de cuidado não emite telemetria, ela **não existe**.

A mesma infraestrutura que monitora latência de API monitora tempo de triagem, porta-balão, cobertura de bundle sepse e LOS UTI.

---

## 2. Três Pilares — Clínicos e Técnicos

### 2.1 Traces
**Um trace por episódio de cuidado.** Do despacho da ambulância ao recebimento do pagamento, tudo é um único trace distribuído.

Spans típicos:
- `ems.call.received`
- `ems.dispatch`
- `ems.on_scene`
- `ems.transport`
- `ed.arrival`
- `ed.triage`
- `ed.wait`
- `ed.physician_exam`
- `ed.tests_ordered`
- `lab.results`
- `imaging.results`
- `ed.disposition`
- `inpatient.admission`
- `inpatient.daily_round`
- `surgery.time_out`
- `surgery.intra_op`
- `pacu.recovery`
- `discharge.process`
- `billing.close`
- `payment.received`

### 2.2 Metrics
**RED + USE + Clinical KPIs:**
- **RED:** Rate, Errors, Duration (por fluxo).
- **USE:** Utilization, Saturation, Errors (recursos).
- **Clínicos:** door-to-doctor, door-to-balloon, LOS, mortalidade, bundle compliance.

### 2.3 Logs
Estruturados, correlacionados com trace_id, indexados para busca. Nunca usados como fonte primária de verdade, apenas para diagnóstico profundo.

---

## 3. OpenTelemetry como Padrão

- **Instrumentação nativa** em todos os serviços do Velya.
- **Semantic conventions** estendidas para domínio clínico (atributos: `patient.id`, `encounter.id`, `unit`, `specialty`, `severity`).
- **Exportadores**: OTLP para coletores próprios.
- **Correlação**: trace ID propagado em todos os eventos, mensagens, jobs.

---

## 4. SLOs Clínicos

### 4.1 Exemplos
| SLO | Objetivo | Janela |
|---|---|---|
| Door-to-triage < 5 min | 95% | 24h |
| Door-to-doctor (amarelo) < 60 min | 90% | 24h |
| Door-to-needle AVC < 60 min | 85% | 30d |
| Door-to-balloon IAM < 90 min | 90% | 30d |
| Sepse bundle 1h | 85% | 7d |
| Cobertura de TBR na chegada EMS | 95% | 7d |
| Higienização terminal < 60 min | 95% | 24h |
| Resultado lab urgente < 60 min | 95% | 24h |
| Laudo imagem urgente < 60 min | 90% | 24h |
| Reconciliação medicamentosa < 24h | 100% | 7d |
| Handoff com ack | 100% | 7d |

### 4.2 Error budget
Cada SLO tem budget. Estouro consome budget. Budget esgotado → freeze de changes na área + PDCA obrigatório.

---

## 5. No-Data Detection

### 5.1 O que é
A ausência de dados é, por si só, um sinal. Se um fluxo **deveria** emitir telemetria e não emite, **está quebrado**.

### 5.2 Exemplos
- Paciente `TRIAGED` há > 30 min sem evento de reavaliação.
- Leito `DIRTY` há > 2h sem evento de higienização.
- Ambulância despachada há > 2 min sem ePCR iniciado.
- UTI sem registro de sinais vitais na última hora.
- Cirurgia "em andamento" há > tempo_esperado + 2 desvios sem evento `closing`.
- Conta fechada há > 15 dias sem envio ao pagador.
- Prescrição `due` há > 2h sem administração ou justificativa.

### 5.3 Como funciona
Um job dedicado varre estados + eventos e aplica regras `expected_next_event_within`. Quando vence sem evento, gera alerta `flow.broken.detected`.

---

## 6. Detecção de Fluxos Quebrados

### 6.1 Categorias
- **Timeouts de transição** (não saiu de um estado esperado).
- **Handoffs sem ack.**
- **SLO estourado** (duração > meta).
- **Resultado crítico sem ack** em tempo hábil.
- **Integração falhando** (erro HL7/FHIR, fila acumulando).
- **Dados inconsistentes** (paciente em estado X sem pré-condição Y).
- **Volume anormal** (pico ou queda inesperada).

### 6.2 Severidade
- **P0:** risco clínico imediato (código azul sem resposta, resultado crítico sem ack, MTP não iniciado).
- **P1:** SLO clínico estourado (porta-balão, sepse bundle).
- **P2:** SLO operacional estourado (higienização, maqueiro).
- **P3:** tendência preocupante (drift).

---

## 7. Aprendizado com Erros

### 7.1 Incidentes
Todo incidente clínico (near-miss, evento adverso, sentinel event) é registrado como `incident.detected`. Segue PDCA:
- **Plan:** análise de causa-raiz.
- **Do:** correção imediata + teste.
- **Check:** verificação de eficácia.
- **Act:** padronização.

### 7.2 Catálogo de erros
- Cada erro vira um **padrão detectável**.
- O mesmo padrão, recorrendo, dispara alerta mesmo antes de virar incidente.
- O catálogo cresce com o uso.

### 7.3 Exemplos
- Dose fora do padrão para peso/SC → bloqueio no CPOE + sugestão de correção.
- Antibiótico sem indicação → intervenção da farmácia.
- Transfusão sem critério → CDS interrompe.
- Paciente com alergia documentada e prescrição do alergeno → bloqueio duro.

---

## 8. Agentes Autônomos de Melhoria

### 8.1 Arquitetura
Agentes especializados rodam em loop, observam eventos e estados, e **atuam dentro de limites explícitos**:

| Agente | O que observa | O que faz |
|---|---|---|
| Flow Breaker Detector | Estados e eventos | Detecta quebras, abre ticket |
| Handoff Guardian | Handoffs sem ack | Escala automaticamente |
| SLO Guardian | Métricas vs SLOs | Alerta + sugere ação |
| Bundle Compliance Agent | Bundles clínicos | Preenche checklist + alerta gap |
| PBM Agent | Candidatos a transfusão | Sugere otimizações |
| Stewardship Agent | Antibióticos | Sugere de-escalonamento |
| Safety Pattern Agent | Near-miss + erros | Detecta padrão emergente |
| Capacity Agent | Fluxo de leitos | Sugere altas prioritárias |
| Schedule Optimizer | CC | Sugere realocação |
| Inventory Agent | Supply chain | Dispara pedidos |

### 8.2 Limites
- Agentes **propõem**, humanos **decidem** em decisões clínicas irreversíveis.
- Agentes **executam** em decisões administrativas reversíveis.
- Toda ação é auditada.
- Kill switch global.

### 8.3 Humans in the loop
- Proposta do agente é enviada ao responsável clínico.
- Aceitação, rejeição ou edição.
- Feedback alimenta o agente (RLHF interno).

---

## 9. Observabilidade do Próprio Velya

### 9.1 Métricas internas
- Latência de APIs.
- Throughput de eventos.
- Fila de mensagens.
- Taxa de erro por serviço.
- Uptime de integrações externas.
- Tempo de resposta dos LLMs usados.

### 9.2 Health checks
- Ativos em todos os serviços.
- Agregados em um dashboard de saúde.
- Auto-restart + circuit breaker.

### 9.3 Chaos engineering
- Testes periódicos de falha em sandbox.
- Validação de failover.

---

## 10. Auditoria Regulatória

### 10.1 LGPD
- Logs de acesso a dados pessoais imutáveis.
- Relatório por titular sob demanda.
- Consentimento explícito rastreado.

### 10.2 HIPAA-like
- Minimum necessary.
- Break-glass logado.

### 10.3 ANS/ANVISA
- Rastreabilidade de lotes.
- Farmacovigilância.
- Hemovigilância.
- Tecnovigilância.

### 10.4 Acreditação (ONA, JCI)
- Compliance de protocolos.
- Indicadores institucionais.
- Trilha de evidências.

---

## 11. Melhoria Contínua Orientada por Dados

### 11.1 Ciclo mensal
1. **Extração** de métricas e eventos.
2. **Análise** por comitê multidisciplinar.
3. **Identificação** de top 3 oportunidades.
4. **Plano de ação** com responsáveis.
5. **Implementação** rastreada.
6. **Medição** do impacto.
7. **Padronização** do que funcionou.

### 11.2 Comitês que usam observabilidade
- CCIH
- NSP
- Comitê de óbito
- Tumor board
- Stewardship
- Qualidade institucional
- Governança clínica

---

## 12. Cultura

Observabilidade nativa + melhoria contínua só funcionam com:
- **Transparência radical** (dados visíveis a todos os envolvidos).
- **Segurança psicológica** (erros vistos como oportunidade).
- **Just culture** (distinção entre erro honesto, comportamento arriscado e violação).
- **Liderança comprometida** (prioriza melhoria sobre blame).

O Velya fornece a infraestrutura. A cultura é construída pelo hospital.

---

## 13. Síntese — Como o Sistema se Auto-Observa

```
                     +-------------------------+
                     | eventos clínicos + tech |
                     +-------------------------+
                             |
                 +-----------+-----------+
                 |           |           |
              traces      metrics      logs
                 |           |           |
                 +-----------+-----------+
                             |
                    SLOs e Catálogo de Erros
                             |
                 +-----------+-----------+
                 |                       |
         No-Data Detection       Flow Broken Detect.
                 |                       |
                 +-----------+-----------+
                             |
                        Agentes Autônomos
                             |
              +--------------+--------------+
              |                             |
        Propostas                     Ações reversíveis
              |                             |
         Humanos em loop              Auditoria
              |                             |
        Melhorias padronizadas  <----  Aprendizado
```

O Velya não é só um EHR que registra. É um hospital que **observa a si mesmo** e **se corrige continuamente**, dentro de limites definidos por humanos.
