# Mapeamento de Capacidades Públicas do Philips Tasy -> Velya Hospital Operating System

> Documento de benchmark. Objetivo: mapear de forma honesta cada capacidade publicamente
> divulgada do Philips Tasy (HIS/EHR web integrado, líder KLAS Acute Care EMR LatAm 2022/2023,
> usado por mais de 1.500 instituições) e explicitar como a plataforma Velya endereça cada
> uma delas e o diferencial estrutural que a Velya traz.

---

## 1. Contexto do benchmark

O Philips Tasy HCIS é um sistema integrado de gestão hospitalar baseado em HTML5, com
cobertura clínica, organizacional, financeira e administrativa. Suas capacidades públicas
foram agrupadas aqui em seis grandes domínios, que são o eixo do mapeamento:

1. Clinical Care (prontuário, ordens, decisão clínica, enfermagem)
2. Medication (ciclo fechado de medicação, farmácia clínica)
3. Operations (leitos, fluxo, cirurgias, escalas)
4. Revenue (faturamento, glosas, custos, contabilidade)
5. Ancillary (laboratório, imagem, patologia, nutrição)
6. Integration & Platform (interoperabilidade, mobilidade, portais)

Para cada capacidade, o mapeamento abaixo descreve:

- **Capacidade Tasy** — o que o Tasy entrega publicamente.
- **Módulo Velya** — qual bounded context cobre.
- **Diferencial Velya** — o que a arquitetura Velya faz diferente/melhor por construção.

---

## 2. Clinical Care

| Capacidade Tasy | Módulo Velya | Diferencial Velya |
|---|---|---|
| Prontuário Eletrônico integrado multiprofissional | `clinical-care` + `patient-journey` | Event sourcing com reconstrução temporal: qualquer estado do prontuário em qualquer instante é reproduzível byte-a-byte para auditoria, pesquisa e litígio. |
| CPOE (Computerized Physician Order Entry) | `clinical-orders` | Orders como agregados com máquina de estados formal, política declarativa (OPA), e commit atômico por evento — nunca há ordem parcial ou "meio prescrita". |
| Suporte à decisão clínica em tempo real | `clinical-decision` + `agents` | Agents governados (draft/shadow/active), kill switch, scorecards versionados e explainability obrigatória — cada alerta carrega a cadeia de evidências. |
| Checklists e protocolos assistenciais | `care-pathways` | Pathways declarativos versionados em YAML, com execução como workflow, instrumentação OpenTelemetry nativa. |
| Avaliações estruturadas de enfermagem (Braden, Morse, dor, NEWS2, Glasgow) | `structured-assessments` | Engine no-code de formulários com versionamento semântico de templates, migrações de dados históricos e disparo de ações via eventos. |
| Evolução clínica multiprofissional | `clinical-notes` | Notas como documentos imutáveis assinados (ICP-Brasil) com hash encadeado — adulteração é detectável. |
| Prontuário pediátrico/neonatal/obstétrico | `clinical-care/specialties` | Perfis de paciente como projeções CQRS específicas; o mesmo evento clínico gera visões distintas por persona. |
| Alergias e alertas | `clinical-safety` | Alergias são fatos versionados; toda prescrição passa por `safety-checker` agent antes de commit. |

---

## 3. Medication (Ciclo Fechado)

| Capacidade Tasy | Módulo Velya | Diferencial Velya |
|---|---|---|
| Prescrição eletrônica estruturada | `medication/prescription` | Prescrição é um agregado com validação farmacológica no momento do comando (não após). |
| Revisão farmacêutica | `pharmacy/clinical-review` | Fila de revisão com SLA instrumentado, priorização por risco clínico e intervenções rastreadas como eventos. |
| Dispensação / unit dose | `medication/dispensing` | Integração nativa com armários inteligentes via eventos NATS; cada dose tem lote, validade e rastreabilidade completa. |
| Preparo em farmácia (quimioterapia, NPT, diluições) | `pharmacy/compounding` | Workflow de preparo com dupla checagem digital, fotografia obrigatória, validação de cálculo e assinatura dupla. |
| Administração beira-leito com bar code | `medication/bedside-administration` | "Cinco certos" digitais como política obrigatória; scan de pulseira + scan de dose + scan do profissional, commit atômico. |
| Reconciliação medicamentosa (admissão/transferência/alta) | `pharmacy/reconciliation` | Reconciliação é um agregado de longa duração com estados formais e histórico completo de decisões. |
| Closed-loop end-to-end | `medication/closed-loop` | Todos os passos emitem eventos na mesma stream: prescrição -> revisão -> dispensação -> preparo -> administração -> reconciliação. Sem "elos quebrados". |
| Smart pumps e bombas de infusão | `medication/infusion` | Integração via IHE PCD-01 e eventos diretos da bomba; parâmetros de infusão são parte do evento clínico. |

---

## 4. Operations

| Capacidade Tasy | Módulo Velya | Diferencial Velya |
|---|---|---|
| Bed management (ocupação, limpeza, manutenção) | `operations/bed-management` | Estado do leito modelado como máquina de estados; transições são eventos auditáveis com responsável. |
| Patient flow / boarding / transferências | `operations/patient-flow` | Fluxo como projeção em tempo real sobre o mesmo event stream do prontuário. |
| Agendamento cirúrgico | `operations/surgical-scheduling` | Otimização multi-restrição (sala, equipe, equipamento, material, anestesia) como serviço dedicado. |
| Centro cirúrgico / sala de operação | `operations/or-management` | Timeline cirúrgica completa integrada ao patient journey. |
| Escalas e alocação de equipes | `workforce/scheduling` | Alocação com base em competências versionadas e restrições regulatórias (CLT, CFM, COREN). |
| Higienização e manutenção | `operations/housekeeping` | Tickets como agregados com SLA e integração mobile para equipe operacional. |
| Command center / bed huddle | `operations/command-center` | Dashboard unificado construído sobre métricas OpenTelemetry e projeções tempo-real. |

---

## 5. Revenue Cycle

| Capacidade Tasy | Módulo Velya | Diferencial Velya |
|---|---|---|
| Cadastro de paciente e convênios | `revenue/registration` | Identidade do paciente como fonte de verdade FHIR Patient, com MPI determinístico + probabilístico. |
| Autorização prévia / TISS | `revenue/authorization` | Integração TISS/ANS via adapters dedicados; autorizações como agregados com estado. |
| Faturamento de contas hospitalares | `revenue/billing` | Conta hospitalar construída como projeção do patient journey — cada lançamento é rastreável ao evento clínico que o gerou. |
| Gestão de glosas e recursos | `revenue/denials` | Motor de regras por operadora, fila de recursos instrumentada, histórico completo. |
| Contabilidade e integração ERP | `revenue/accounting` | Eventos financeiros via NATS JetStream integrados ao ERP por adapters certificados. |
| Custos por paciente (ABC) | `revenue/costing` | Custeio ABC nativo: cada evento clínico carrega metadados de custo, sem reprocessamento mensal. |
| Indicadores corporativos | `revenue/kpi` | KPIs como views materializadas sobre event store, com lineage completo. |

---

## 6. Ancillary (Serviços de Apoio)

| Capacidade Tasy | Módulo Velya | Diferencial Velya |
|---|---|---|
| Laboratório (pedido, coleta, resultado) | `ancillary/lab` | LIS como bounded context com integração FHIR ServiceRequest/Observation e HL7 v2 para equipamentos legados. |
| Imagem e PACS | `ancillary/imaging` | DICOMweb nativo; laudos como DiagnosticReport FHIR versionados. |
| Patologia | `ancillary/pathology` | Worklist de patologia integrada ao mesmo event stream. |
| Nutrição e dietética | `ancillary/nutrition` | Prescrição dietética com conflito automático contra alergias, restrições e protocolos. |
| Banco de sangue | `ancillary/bloodbank` | Rastreabilidade completa de bolsa, compatibilidade e transfusão como eventos clínicos. |
| Fisioterapia/reabilitação | `ancillary/rehab` | Planos de reabilitação como pathways versionados. |

---

## 7. Integration & Platform

| Capacidade Tasy | Módulo Velya | Diferencial Velya |
|---|---|---|
| HTML5 web-based | `frontend/web` | SPA tipada com React + tRPC, acessibilidade WCAG 2.1 AA, tipos compartilhados backend<->frontend. |
| Mobile-friendly | `mobile/*` | Apps nativos React Native com workflows beira-leito, offline-first e sincronização por eventos. |
| Integração HL7 / DICOM | `interoperability/legacy` | Adapters HL7 v2/v3 + FHIR R4 + DICOMweb sob o mesmo event bus. |
| Portais (paciente, médico externo) | `portals/*` | Portais como frontends independentes consumindo API FHIR + OIDC. |
| Relatórios / BI | `analytics/warehouse` | Lakehouse com CDC a partir do event store; consultas não impactam transacional. |
| Multi-unidade / multi-CNPJ | `platform/multi-tenancy` | Tenancy hierárquica nativa (grupo -> hospital -> unidade -> ala). |

---

## 8. O que o Velya faz que o Tasy não publiciza (ou não entrega)

- **Event sourcing auditável** — reconstrução temporal real de qualquer estado.
- **Agents governados** — IA clínica com fases formais, kill switches e scorecards.
- **OpenTelemetry nativo** — observabilidade clínica, operacional e financeira na mesma correlação.
- **Break-glass auditado** com notificação síncrona ao DPO e ao conselho clínico.
- **Assinatura ICP-Brasil** em documentos clínicos com hash encadeado.
- **Tipagem estática fim-a-fim** (TypeScript backend <-> frontend <-> mobile via tRPC/FHIR types).
- **Deploy cloud-native** em Kubernetes com GitOps (ArgoCD), sem "janela de manutenção" nas atualizações.
- **Policy-as-code** (OPA/Rego) para regras clínicas, financeiras e de segurança — versionadas em git.

---

## 9. Critérios de aceitação do benchmark

Para que o Velya seja considerado "paridade + diferencial" com o Tasy em um domínio, ele precisa:

1. Cobrir 100% das capacidades públicas listadas acima naquele domínio.
2. Expor observabilidade (métricas RED + USE) nativa por bounded context.
3. Manter rastreabilidade evento -> caso clínico -> conta hospitalar -> registro contábil.
4. Suportar desligamento seletivo de features por tenant sem rebuild.
5. Entregar mobile com paridade funcional mínima de 80% do desktop.

---

## 10. Referências públicas

- Philips Tasy HCIS — páginas oficiais de produto Philips.
- KLAS Research — Acute Care EMR Latin America 2022/2023.
- HL7 FHIR R4 — https://www.hl7.org/fhir/R4/
- IHE Profiles — https://www.ihe.net/
- Este documento é observacional e não representa posição oficial da Philips.
