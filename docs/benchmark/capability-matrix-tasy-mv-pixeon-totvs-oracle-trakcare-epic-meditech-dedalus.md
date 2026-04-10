# Matriz de Capacidades — 9 Fornecedores + Velya Target

## Objetivo

Este documento é a **matriz comparativa massiva** que consolida, em um único lugar, o que cada um dos nove fornecedores de sistemas hospitalares entrega em cada um dos **dez domínios funcionais** que consideramos estruturais para um sistema hospitalar moderno. A última coluna mostra o **Velya Target State** — o que a plataforma Velya **deve** cobrir para competir e superar o mercado.

## Convenção de Marcação

- `✓` — **Documentado publicamente** (site oficial, whitepaper, case, briefing KLAS, HIMSS release)
- `⚠` — **Inferido** (não há documentação explícita, mas é razoável deduzir pela descrição do produto ou pelo porte)
- `?` — **Sem evidência pública clara** (ausência relevante que merece investigação)
- `★` — **Diferencial reconhecido** (feature em que o fornecedor é referência de mercado)

## Os Dez Domínios Funcionais

1. **Clinical Core** — PEP, documentação clínica, evoluções, diagnósticos, sinais vitais
2. **Medication** — prescrição eletrônica, CPOE, alertas de interação, circuito fechado
3. **Patient Journey** — jornada do paciente, timeline unificada, milestones, handoffs
4. **Ancillary** — laboratório, imagem, farmácia, centro cirúrgico, UTI
5. **Operations** — leitos, escala, agendamento, housekeeping, recursos
6. **Financial / RCM** — faturamento, glosa, autorização, revenue cycle
7. **Audit / Legal** — logs, compliance, LGPD, proveniência, trilha forense
8. **Mobility / Portal** — apps mobile, portal do paciente, notificações
9. **Interoperability** — FHIR, HL7, DICOM, SNOMED, APIs públicas
10. **Analytics / AI** — BI, dashboards, ML, agentes, governança de IA

---

## Matriz Consolidada

### Domínio 1 — Clinical Core

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| PEP estruturado | ✓★ | ✓★ | ✓ | ✓ | ✓★ | ✓ | ✓★ | ✓ | ✓★ | ✓ |
| Evolução livre + estruturada | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocolos clínicos | ✓ | ✓ | ⚠ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Score de alerta precoce (MEWS/NEWS2) | ✓ | ✓ | ? | ? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CDS (Clinical Decision Support) | ✓ | ✓ | ⚠ | ⚠ | ✓★ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| Suporte a múltiplas especialidades | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓★ | ✓★ | ✓ | ✓★ | ✓ |
| Documentação por voz / ambient AI | ? | ? | ? | ? | ✓★ | ⚠ | ✓ | ✓ | ⚠ | ✓ |

### Domínio 2 — Medication

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| CPOE | ✓★ | ✓★ | ⚠ | ✓ | ✓★ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| Alertas de interação | ✓ | ✓★ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reconciliação medicamentosa | ✓ | ✓ | ? | ⚠ | ✓ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| Closed-loop (prescrição → admin) | ✓★ | ✓ | ? | ⚠ | ✓★ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| Código de barras beira-leito | ✓ | ✓ | ? | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Farmácia clínica | ✓ | ✓ | ⚠ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Drug formulary nacional | ✓ | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ |

### Domínio 3 — Patient Journey

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| Conceito de jornada formal | ✓ | ⚠ | ? | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ⚠ | ✓★ |
| Timeline unificada clínica+op+fin | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |
| Clinical pathways | ✓ | ✓ | ? | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Milestones observáveis | ⚠ | ⚠ | ? | ⚠ | ⚠ | ✓ | ⚠ | ⚠ | ⚠ | ✓★ |
| Handoff estruturado (SBAR) | ⚠ | ⚠ | ? | ? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Timeline de dor / conforto | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |
| Timeline de chamadas / campainha | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |
| Previsão de LOS | ⚠ | ⚠ | ? | ? | ✓ | ✓★ | ✓ | ✓ | ✓ | ✓ |

### Domínio 4 — Ancillary

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| LIS (Laboratório) | ✓ | ✓ | ✓★ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RIS / PACS | ✓ | ✓ | ✓★ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Farmácia hospitalar | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Centro cirúrgico | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| UTI (flow sheets, ventilação) | ✓ | ✓ | ? | ⚠ | ✓ | ✓★ | ✓ | ✓ | ✓ | ✓ |
| Oncologia | ⚠ | ✓ | ? | ⚠ | ✓ | ✓★ | ✓ | ✓ | ✓ | ⚠ |
| Emergência / PA | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓★ | ✓ | ✓ | ✓ |

### Domínio 5 — Operations

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| Gestão de leitos | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| ADT (Admissão/Transf/Alta) | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| Housekeeping / limpeza | ⚠ | ⚠ | ? | ⚠ | ✓ | ✓ | ✓★ | ✓ | ⚠ | ✓ |
| Escala de profissionais | ⚠ | ✓ | ? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agendamento multi-recurso | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓★ | ✓ | ✓ | ✓ |
| Patient flow optimization (ML) | ? | ? | ? | ? | ⚠ | ✓★ | ✓ | ✓ | ⚠ | ✓ |
| Central de regulação | ✓ | ✓ | ? | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ |

### Domínio 6 — Financial / RCM

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| Faturamento hospitalar | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gestão de glosa | ✓ | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ |
| Autorização eletrônica (TISS) | ✓ | ✓ | ⚠ | ✓ | ? | ? | ? | ? | ? | ✓ |
| Charge capture | ✓ | ✓ | ⚠ | ✓ | ✓★ | ✓ | ✓★ | ✓★ | ✓ | ✓ |
| Claims management | ⚠ | ✓ | ? | ✓ | ✓★ | ✓ | ✓★ | ✓★ | ✓ | ✓ |
| Denial AI | ? | ? | ? | ? | ⚠ | ⚠ | ⚠ | ✓★ | ⚠ | ✓ |
| Clinically driven RCM | ? | ? | ? | ? | ✓★ | ⚠ | ✓ | ✓ | ⚠ | ✓ |

### Domínio 7 — Audit / Legal

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| Log de acesso | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Log de alteração | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hash chain / proveniência cripto | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |
| LGPD / GDPR compliance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Certificação SBIS | ⚠ | ✓ | ✓★ | ⚠ | ? | ? | ? | ? | ? | ✓ |
| Trilha forense exportável | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓★ |
| Justificativa obrigatória de acesso | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ✓ |

### Domínio 8 — Mobility / Portal

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| App médico mobile | ⚠ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓★ | ✓ | ✓★ |
| App enfermagem mobile | ⚠ | ✓ | ? | ⚠ | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓★ |
| App paciente (portal) | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓★ | ✓★ | ✓ | ✓ |
| Notificações push | ⚠ | ⚠ | ? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Teleconsulta | ⚠ | ✓ | ? | ✓★ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ |
| Mobile offline-first | ? | ? | ? | ? | ? | ? | ⚠ | ⚠ | ? | ✓★ |
| WhatsApp nativo | ? | ⚠ | ? | ✓★ | ? | ? | ? | ? | ? | ✓ |

### Domínio 9 — Interoperability

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| HL7 v2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FHIR R4 | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓★ | ✓★ | ✓ | ✓★ | ✓★ |
| DICOM | ✓ | ✓ | ✓★ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SNOMED CT | ⚠ | ⚠ | ⚠ | ? | ✓ | ✓ | ✓ | ✓ | ✓★ | ✓ |
| TUSS / TISS | ✓ | ✓ | ✓ | ✓ | ? | ? | ? | ? | ? | ✓ |
| APIs públicas documentadas | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓★ |
| Event streaming (Kafka/FHIR subs) | ? | ? | ? | ? | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓★ |

### Domínio 10 — Analytics / AI

| Capacidade | Tasy | MV | Pixeon | TOTVS | Oracle | TrakCare | Epic | MEDITECH | Dedalus | **Velya** |
|---|---|---|---|---|---|---|---|---|---|---|
| BI / dashboards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Relatórios customizáveis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ML preditivo (no-show, readmissão) | ⚠ | ⚠ | ? | ⚠ | ✓ | ✓★ | ✓ | ✓ | ✓ | ✓ |
| Ambient AI (voz → nota) | ? | ? | ? | ? | ✓★ | ⚠ | ✓ | ⚠ | ⚠ | ✓ |
| Agentes LLM governados | ? | ? | ? | ? | ⚠ | ✓ | ⚠ | ⚠ | ⚠ | ✓★ |
| Kill switch de agentes | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |
| Evaluation harness contínuo | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |
| Observabilidade nativa OTel | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✓★ |

---

## Leitura Horizontal — Velya Pontua Onde?

O Velya Target cobre os domínios clássicos com paridade, mas **ganha o jogo** nos seguintes marcadores `✓★` exclusivos:

1. **Timeline unificada** clínica + operacional + financeira + chamadas + dor + handoff (Patient Journey)
2. **Hash chain / proveniência criptográfica** e trilha forense exportável (Audit)
3. **Mobile offline-first** com experiência nativa (Mobility)
4. **APIs públicas documentadas + event streaming** de primeira classe (Interop)
5. **Agentes LLM governados**, com kill switch e evaluation harness (AI)
6. **Observabilidade nativa** OpenTelemetry end-to-end (AI/Infra)

Cada um desses marcadores aparece como `?` ou `⚠` em todos os nove concorrentes. Este é o espaço competitivo do Velya.

## Leitura Vertical — Qual Fornecedor Mais Ameaça?

| Posição | Fornecedor | Razão |
|---|---|---|
| 1 | **Epic** | Maior número de `✓★`; referência global de profundidade funcional |
| 2 | **Oracle Health** | Ambient AI + clinically driven RCM; escala global |
| 3 | **InterSystems TrakCare** | AI Patient Flow + IRIS data platform; único com marcação forte em ML |
| 4 | **MEDITECH Expanse** | Único cloud-first genuíno; Discharge AI e MyHealth diferenciais |
| 5 | **MV SOUL MV** | Domínio Brasil; PEP reconhecido 6 anos consecutivos |
| 6 | **Philips Tasy** | Domínio Brasil; HTML5; base instalada grande |
| 7 | **Dedalus ORBIS U** | 68+ módulos; microservices + AWS |
| 8 | **TOTVS Saúde** | Jornada digital completa; WhatsApp nativo |
| 9 | **Pixeon** | Força concentrada em imagem |

Nosso benchmark primário é **Epic + MEDITECH Expanse + Oracle Ambient AI + MV SOUL MV** (para Brasil). O resto informa, mas não dita.
