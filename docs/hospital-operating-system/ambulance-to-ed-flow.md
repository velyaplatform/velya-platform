# Fluxo Ambulância → Emergência (EMS → ED)

> **Inspirado em:** protocolos Massachusetts/Maine/Maryland 2025 (atualização 1º dez 2025), Team-Based Reporting (TBR), ePCR transfer, Warm Handoff estruturado.

---

## 1. Por que este fluxo é crítico

O handoff EMS → ED é um dos **momentos de maior fragilidade** do cuidado. Estudos mostram que mais de **30% dos dados clínicos** da fase pré-hospitalar se perdem se o handoff for verbal, desestruturado e unilateral.

O Velya implementa três mecanismos combinados:
1. **ePCR transfer** — dados pré-hospitalares chegam antes do paciente.
2. **Pre-arrival notification** — alerta ativo na ED com ETA e resumo.
3. **Team-Based Reporting (TBR)** — a equipe da ED se reúne na bay no momento da chegada para receber o handoff sincronamente.

---

## 2. Os 7 Passos do Fluxo

```
[1] Chamada 192 / Acionamento
[2] Regulação (despacho + CCR)
[3] Despacho da viatura + início do ePCR
[4] Atendimento em cena + atualização do ePCR
[5] Transporte + pré-notificação ao hospital
[6] Chegada + TBR + Warm Handoff
[7] Transferência de responsabilidade + fechamento do ePCR
```

---

## 3. Passo 1 — Chamada e Triagem

- **Gatilho:** ligação 192 (SAMU), 193 (Bombeiros), 190 (PM), serviço privado (AMBs particulares).
- **Ator:** TARM (Técnico Auxiliar de Regulação Médica) → médico regulador.
- **Ação:** classificação da queixa (protocolo MPDS ou equivalente), priorização, envio de recurso.

---

## 4. Passo 2 — Regulação e Despacho

- **Médico regulador** decide: recurso (USB — suporte básico, ou USA — suporte avançado), código de urgência, hospital de destino.
- **Central de regulação** verifica disponibilidade do hospital receptor (vagas, especialidade, nível de complexidade).
- **Aceite do hospital** é registrado na regulação.

### 4.1 No Velya
- A central de regulação é um **consumidor** de eventos da ED (ocupação, red room disponível, tempo médio de espera).
- Decisão de destino integra com o **dashboard de ambulâncias** do hospital.

---

## 5. Passo 3 — Despacho da Viatura e Início do ePCR

- Equipe (motorista, enfermeiro, técnico, médico se USA) parte para o local.
- **ePCR** (Electronic Patient Care Report) é aberto no tablet/dispositivo da viatura.
- GPS contínuo da viatura é transmitido.

### 5.1 Dados iniciais do ePCR
- Identificação da viatura + equipe
- Queixa principal informada pela central
- Timestamp de despacho
- Destino provável

---

## 6. Passo 4 — Atendimento em Cena

### 6.1 Coleta de dados que vai para o ePCR em tempo real
- Nome, DN, documento (se possível).
- Queixa principal, HDA.
- Sinais vitais seriados (PA, FC, FR, SpO2, Tax, HGT, ECG).
- Exame físico dirigido.
- Procedimentos realizados (IOT, acesso, medicação, desfibrilação).
- Medicamentos administrados (dose, via, horário).
- Resposta do paciente.
- Protocolos acionados (AVC, IAM, trauma, parto).
- Fotos (quando autorizado: lesões, cenário).

### 6.2 Integração com protocolos
- **AVC positivo (LAPSS/Cincinnati):** dispara pré-notificação de **código AVC** na ED.
- **IAM com supra (ECG 12 derivações):** dispara **código IAM** + hemodinâmica.
- **Trauma grave:** trauma alert, sala vermelha reservada.
- **PCR:** código azul preparado.

---

## 7. Passo 5 — Transporte + Pré-notificação

### 7.1 Pré-notificação estruturada
Assim que a viatura sai da cena, o **ePCR sincroniza com o hospital receptor**. A ED recebe:
- ETA calculado (GPS + trânsito).
- Resumo ePCR (snapshot atual).
- Queixa principal.
- Sinais vitais atuais + tendência.
- Procedimentos em andamento.
- Protocolo acionado.
- Necessidade especial (sala de isolamento, red room, BCP, hemodiálise, etc.).

### 7.2 Recebimento na ED
O dashboard de ambulâncias mostra:
- Cards de cada viatura a caminho.
- ETA em tempo real.
- Status (a caminho, em cena, retornando).
- Resumo clínico acessível em 1 clique.

### 7.3 Ações automáticas da ED
- **Reserva de bay** da ED.
- **Preparo de equipe** (acionamento do TBR).
- **Preparação de recursos** (sala vermelha, material específico).
- **Banco de sangue**: pré-reserva de O- se trauma grave.
- **Imagem**: CT disponível para AVC.
- **Hemodinâmica**: ativação se IAM supra.

---

## 8. Passo 6 — Chegada, TBR e Warm Handoff

### 8.1 Team-Based Reporting (TBR)

> **Princípio do TBR:** trazer **toda** a equipe da ED que cuidará do paciente **à beira-leito da chegada** para receber o handoff ao mesmo tempo. Evita retransmissão de dados, reduz perdas.

**Quem participa do TBR:**
- Médico emergencista receptor.
- Enfermeiro receptor.
- Técnico de enfermagem designado.
- Se protocolo ativo: neurologista de plantão (AVC), hemodinamicista (IAM), cirurgião (trauma).
- Scribe (documentação em tempo real) quando disponível.

### 8.2 Estrutura do Warm Handoff
Modelo **SBAR** ou **IMIST-AMBO**:
- **I** — Identification (quem é o paciente)
- **M** — Mechanism / Medical complaint
- **I** — Injuries / Information (achados)
- **S** — Signs (sinais vitais e tendência)
- **T** — Treatment (tratamentos dados + resposta)
- **A** — Allergies
- **M** — Medications
- **B** — Background
- **O** — Other (context, família, local)

### 8.3 Protocolo de comunicação
- **Silêncio intencional:** toda a equipe ouve o EMS sem interromper por 60 segundos.
- **Perguntas e dúvidas:** depois do relato inicial.
- **Transferência física:** para a maca da ED após handoff.
- **Acknowledgement:** médico e enfermeiro da ED assinam digitalmente o recebimento do paciente.

### 8.4 No Velya
- Evento `handoff.ems_ed.initiated`
- Evento `handoff.ems_ed.acknowledged` (obrigatório antes de liberar a viatura)
- Timer de TBR: < 5 minutos
- Trace ID do ePCR vira pai do trace da ED (continuidade)

---

## 9. Passo 7 — Transferência de Responsabilidade

### 9.1 Responsabilidade legal
- No Brasil, a partir do momento em que o receptor assina o handoff, a responsabilidade é da ED.
- Enquanto o paciente estiver na maca da ambulância dentro do hospital sem handoff completo, a responsabilidade ainda é do EMS.

### 9.2 Fechamento do ePCR
- O ePCR continua editável pelo EMS por 2h para complementação.
- Passa a ser **documento oficial** que fica em ambos os sistemas (EMS + hospital).
- Integrado ao prontuário da ED como anexo estruturado + campos mapeados.

### 9.3 Liberação da viatura
- A equipe de EMS limpa a viatura.
- Reabastece materiais consumidos.
- Retorna status "disponível" para a central.

---

## 10. Modos Especiais

### 10.1 Chegada sem pré-notificação (walk-in via ambulância particular)
- Ainda é **warm handoff obrigatório**, mas sem preparo prévio.
- Mais tempo para coletar histórico.
- SLA relaxado em 2–5 minutos.

### 10.2 Chegada de helicóptero
- Heliponto → maca → ED.
- Tempos mais críticos (casos politrauma).
- TBR reforçado (ortopedia, neurocirurgia, CTBM).

### 10.3 Múltiplas vítimas
- Plano de contingência ativado.
- Triagem START/SALT na cena + reconfirmação na porta.
- Command center hospitalar ativado.

---

## 11. Métricas do Fluxo

| Métrica | Meta |
|---|---|
| Tempo despacho → cena | ≤ 10 min (urbano) |
| Tempo em cena | ≤ 20 min |
| Pré-notificação → chegada | ≥ 5 min |
| Porta → TBR completo | ≤ 5 min |
| Porta → médico atendendo | ≤ 5 min |
| Cobertura de ePCR transferido antes da chegada | ≥ 95% |
| Handoff com acknowledgement | 100% |
| Liberação da viatura | ≤ 15 min após chegada |

---

## 12. Dashboards Relacionados

Ver `command-centers-and-dashboards.md`:
- **Dashboard de ambulâncias a caminho** (ETA, cards, protocolos).
- **Dashboard de ED bays** (ocupação, prontidão).
- **Dashboard de tempos de handoff** (cobertura de TBR, tempos).

---

## 13. Observabilidade

- Trace clínico: `trace_id = emergency_call_id`.
- Spans: chamada → despacho → cena → transporte → chegada → handoff → ED encounter.
- SLO automático: cobertura de TBR < 90% dispara alerta.
- No-data detection: viatura saiu do centro mas ePCR vazio > 2 min → alerta.
