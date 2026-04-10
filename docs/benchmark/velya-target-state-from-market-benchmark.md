# Velya Target State — Derivado do Benchmark de Mercado

## Objetivo

Este documento consolida, capacidade por capacidade, **o que Velya deve fazer** à luz do que os nove fornecedores (Tasy, MV, Pixeon, TOTVS, Oracle Health, TrakCare, Epic, Expanse, Dedalus) entregam. Cada linha identifica:

- **Capacidade** — o que está sendo considerado
- **Fonte** — qual fornecedor inspira ou é referência
- **O que Velya faz** — a decisão de produto Velya
- **Ação** — `copy` / `adapt` / `improve` / `reject` / `backlog`

As decisões aqui são **normativas**: alimentam o roadmap, o design e a comunicação comercial do Velya.

---

## Convenções

| Ação | Significado |
|---|---|
| `copy` | Adotar praticamente igual ao concorrente referência |
| `adapt` | Adotar o conceito, reimaginando na arquitetura Velya |
| `improve` | Entregar superior ao concorrente (diferencial competitivo) |
| `reject` | Não fazer — a escolha do concorrente é inadequada para Velya |
| `backlog` | Importante, mas fica para fase posterior do roadmap |

---

## Domínio 1 — Clinical Core

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| PEP estruturado multi-profissional | MV SOUL MV | PEP com médico, enfermagem, fisio, nutri, psico, fono, serviço social desde o MVP | `copy` |
| Evolução livre + estruturada | Philips Tasy | Suporte a texto livre e formulário estruturado no mesmo fluxo | `copy` |
| Protocolos clínicos parametrizáveis | Philips Tasy + MV | Pathways versionados como eventos observáveis, não fluxograma estático | `adapt` |
| Score de alerta precoce (MEWS/NEWS2) | Epic + TrakCare | Nativo, calculado em tempo real, emitindo eventos | `copy` |
| CDS (Clinical Decision Support) | Oracle Health + Epic | Embutido com kill switch e evaluation harness **publicados** | `improve` |
| Ambient AI / voice-to-note | Oracle Health + MEDITECH | Roadmap de médio prazo; integração com fornecedores de ASR | `backlog` |
| Classificação de risco (Manchester/ESI) | MV + TOTVS | Nativo na emergência | `copy` |
| SAE (Sistematização Assistência Enfermagem) | MV | Nativo na enfermagem | `copy` |

## Domínio 2 — Medication

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| CPOE | Todos | Prescrição eletrônica multi-item desde MVP | `copy` |
| Alertas de interação medicamentosa | MV SOUL MV | Base de conhecimento nacional, alertas contextuais, observáveis | `copy` |
| Reconciliação medicamentosa | Epic | Fluxo de reconciliação em admissão, transferência e alta | `copy` |
| Closed-loop (prescrição → admin) | Philips Tasy + Epic | Ciclo fechado com código de barras beira-leito e eventos em cada etapa | `adapt` |
| Farmácia clínica | Tasy + Epic Willow | Módulo dedicado com dispensação unitária e validação | `copy` |
| Drug formulary nacional (ANVISA) | MV | Base brasileira atualizada, integrada ao prescriber | `copy` |
| Barcode medication administration | Epic | Leitor no leito, confirmação 5 certos | `copy` |

## Domínio 3 — Patient Journey

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| Conceito de jornada formal | Tasy + TOTVS (mensagem) | Motor de Patient Journey como primeira classe, não mensagem | `improve` |
| **Timeline unificada clínica+op+fin+dor+chamadas+handoff** | **Nenhum** | **Velya é o primeiro a entregar** | `improve` |
| Clinical pathways | Philips + Epic | Pathways versionados, observáveis, com milestones | `adapt` |
| Milestones observáveis | TrakCare (parcial) | Cada milestone emite evento, entra no warehouse, alimenta ML | `improve` |
| Handoff estruturado (SBAR) | Epic + TrakCare | Nativo entre turnos, transferências e altas | `copy` |
| Timeline de dor / conforto | Nenhum | Registro e visualização temporal de escalas de dor e conforto | `improve` |
| Timeline de chamadas / campainha | Nenhum | Integração com sistemas de enfermagem, tempo de resposta observável | `improve` |
| Previsão de LOS | TrakCare | ML com evaluation harness | `adapt` |

## Domínio 4 — Ancillary

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| LIS (Laboratório) | Pixeon | Módulo nativo ou integração FHIR profunda | `copy` |
| RIS / PACS | Pixeon | Integração DICOM nativa; viewer embarcado | `copy` |
| Farmácia hospitalar | Tasy + Epic | Módulo nativo | `copy` |
| Centro cirúrgico | Epic OpTime | Mapa de sala, tempos, checklist, materiais | `adapt` |
| UTI flow sheets | TrakCare | Flow sheet com ventilação, infusão, score de gravidade | `adapt` |
| Oncologia | Epic Beacon + Dedalus | Pathways de quimio, dosagem por peso/superfície | `backlog` |
| Emergência / PA | Epic ASAP + MV | Manchester, fluxo rápido, prescrição por protocolo | `copy` |

## Domínio 5 — Operations

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| Gestão de leitos | Epic Grand Central | Mapa visual, status em tempo real, eventos de mudança | `copy` |
| ADT | Epic Grand Central | ADT como eventos de primeira classe | `adapt` |
| Housekeeping / limpeza | Epic Grand Central | Integração com equipe de higienização, eventos de limpeza | `copy` |
| Escala de profissionais | MV + Epic | Escala integrada ao RBAC e à Patient Journey | `adapt` |
| Agendamento multi-recurso | Epic Cadence | Agendamento com regras complexas, overbooking, lista de espera | `copy` |
| Patient flow optimization (ML) | TrakCare AI Patient Flow | ML para no-shows, LOS, alta, com kill switch | `adapt` |
| Central de regulação | Tasy + MV | Fila, priorização, transferência entre unidades | `copy` |

## Domínio 6 — Financial / RCM

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| Faturamento hospitalar | MV + Tasy | Módulo nativo com TISS/TUSS | `copy` |
| Gestão de glosa | MV + Tasy | Fluxo de recurso, integração com MEDITECH-like Denial AI | `adapt` |
| Autorização TISS eletrônica | MV + Tasy | API TISS nativa, real-time | `copy` |
| Charge capture | Epic Resolute + Oracle | Captura de cobrança no ponto de atendimento, sem fricção | `copy` |
| Claims management | Epic | Gestão de reclamações e recursos | `copy` |
| Denial AI | MEDITECH Expanse | Agente IA com kill switch e evaluation harness | `adapt` |
| Clinically driven RCM | Oracle Health | Cobrança nasce da decisão clínica via eventos | `adapt` |
| Eligibility em tempo real | Epic + Oracle | Verificação de convênio durante o atendimento | `copy` |
| **30-48% aumento em collections** | MEDITECH Expanse | Meta comercial Velya: perseguir métrica comparável | `copy` |

## Domínio 7 — Audit / Legal

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| Log de acesso e alteração | Todos | Log estruturado + telemetria OTel | `copy` |
| **Hash chain / proveniência criptográfica** | **Nenhum** | **Velya é o primeiro a entregar** | `improve` |
| LGPD compliance | Todos brasileiros | Nativo | `copy` |
| Certificação SBIS nível máximo | Pixeon | Perseguir certificação prioritária | `copy` |
| **Trilha forense exportável** | **Nenhum** | **Exportação assinada para auditor externo** | `improve` |
| Justificativa obrigatória de acesso | Oracle + Epic | RBAC granular exige razão contextual | `adapt` |
| **Prova criptográfica de integridade** | **Nenhum** | **Velya publica protocolo** | `improve` |

## Domínio 8 — Mobility / Portal

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| App médico mobile | MEDITECH Expanse Now | App nativo iOS/Android desde o dia um | `copy` |
| App enfermagem mobile | Expanse + Epic Rover | App dedicado, beira-leito | `copy` |
| App paciente (portal) | Epic MyChart | App completo — agenda, resultados, pagamento, mensagens | `copy` |
| Notificações push | Todos modernos | Sistema de notificações primário | `copy` |
| Teleconsulta | TOTVS | Nativa, não add-on | `copy` |
| **Mobile offline-first** | **Nenhum maduro** | **Sincronização e trabalho offline** | `improve` |
| WhatsApp nativo | TOTVS | Canal primário para paciente | `copy` |
| Kiosks / autoatendimento | Epic Welcome | Check-in, pagamento, orientação | `adapt` |

## Domínio 9 — Interoperability

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| HL7 v2 | Todos | Suporte nativo | `copy` |
| FHIR R4 | Dedalus + Epic + TrakCare | FHIR como contrato primário, não secundário | `copy` |
| DICOM | Pixeon | Integração nativa, viewer embarcado | `copy` |
| SNOMED CT | Dedalus | Codificação estruturada primária | `copy` |
| TUSS / TISS | MV + Tasy | APIs brasileiras primárias | `copy` |
| **APIs públicas documentadas** | Todos parcialmente | **OpenAPI + portal de developer + sandbox** | `improve` |
| **Event streaming (Kafka / FHIR subscriptions)** | **Nenhum como primeira classe** | **Eventos são primeira classe** | `improve` |
| openEHR | Dedalus | Em áreas específicas de interop semântica | `backlog` |

## Domínio 10 — Analytics / AI

| Capacidade | Fonte | O Que Velya Faz | Ação |
|---|---|---|---|
| BI / dashboards | Todos | Dashboards nativos + observabilidade OTel | `copy` |
| Relatórios customizáveis | Todos | Self-service sobre warehouse | `copy` |
| ML preditivo | TrakCare | No-show, LOS, readmissão, risco — com evaluation harness | `adapt` |
| Ambient AI (voz → nota) | Oracle + MEDITECH | Integração com ASR, voice-to-note | `backlog` |
| **Agentes LLM governados** | Vários parcialmente | **Kill switch, evaluation harness, contratos publicados** | `improve` |
| **Kill switch de agentes** | **Nenhum** | **Cliente pode desligar qualquer agente em 1 click** | `improve` |
| **Evaluation harness contínuo** | **Nenhum** | **CI/CD para agentes com testes automatizados** | `improve` |
| **Observabilidade nativa OTel** | **Nenhum** | **Traces, métricas, logs estruturados em todos os serviços** | `improve` |

---

## Resumo das Decisões

### Decisões `improve` — Velya Diferencial Único

1. Timeline unificada clínica+op+fin+dor+chamadas+handoff (Patient Journey)
2. Hash chain / proveniência criptográfica (Audit)
3. Trilha forense exportável (Audit)
4. Prova criptográfica de integridade (Audit)
5. Mobile offline-first (Mobility)
6. APIs públicas documentadas completas (Interop)
7. Event streaming primeira classe (Interop)
8. Agentes LLM governados publicados (AI)
9. Kill switch de agentes (AI)
10. Evaluation harness contínuo (AI)
11. Observabilidade nativa OTel end-to-end (AI/Infra)
12. CDS com governança publicada (Clinical)
13. Milestones observáveis de Patient Journey (Journey)
14. Timeline de dor (Journey)
15. Timeline de chamadas (Journey)

### Decisões `copy` — Paridade Obrigatória

Todos os itens marcados como `copy` formam a **base de paridade competitiva**: Velya não pode ir a mercado sem essas capacidades. Elas são o "piso funcional" sem o qual nenhum hospital brasileiro consideraria substituir seu sistema atual.

### Decisões `adapt` — Conceitos Reimaginados

Conceitos importados de concorrentes, mas reimaginados na arquitetura Velya (microservices, eventos, observabilidade, governança). São a **camada de sofisticação arquitetural** — o "como" diferente do "o quê".

### Decisões `backlog` — Fase Posterior

- Ambient AI (voice-to-note)
- Oncologia completa (Beacon-like)
- openEHR avançado

### Decisões `reject` — O Que Velya Não Faz

- Dependência de DBMS proprietário (IRIS, Cache)
- Stack legado (.NET monolítico, Oracle DB obrigatório)
- Cliente fat (Hyperspace-style)
- Lock-in em cloud específica (Expanse-Google)
- Cultura "do the [vendor] way" (Epic)
- Consolidação por aquisições (Dedalus path)
- Customização apenas por parametrização proprietária
- Projetos de 12-36 meses de implementação

---

## Uso Deste Documento

Este documento é a **fonte normativa** para:

1. **Roadmap** — `copy` entra no MVP; `adapt` entra nas fases 1-2; `backlog` entra nas fases 3+
2. **Design de produto** — `improve` guia os diferenciais a serem polidos ao máximo
3. **Comunicação comercial** — `improve` forma a narrativa competitiva Velya
4. **Arquitetura** — `reject` define fronteiras arquiteturais inegociáveis

Cada vez que um novo fornecedor é analisado ou um concorrente lança nova capacidade, este documento deve ser revisado. A matriz é viva, não estática.
