# Velya Hospital Operating System — Visão Macro da Plataforma

> Este documento descreve o Velya como um Hospital Operating System completo: 12 macrodomínios,
> arquitetura cloud-native, backbone FHIR, eventos com NATS JetStream, agents governados e
> observabilidade nativa em todas as camadas.

---

## 1. Tese da plataforma

Um hospital é uma máquina de processos clínicos, operacionais, financeiros e regulatórios
rodando em paralelo, 24/7, sobre o mesmo paciente. Sistemas tradicionais (incluindo líderes
consolidados) nasceram como ERPs adaptados ao hospital e sofrem quatro problemas estruturais:

1. **Silos de dados** — clínico em um schema, financeiro em outro, operacional em um terceiro.
2. **Batch everywhere** — lotes noturnos para conciliar o que deveria ser fluxo contínuo.
3. **Customização via código proprietário** — cada cliente vira um fork.
4. **Observabilidade artesanal** — logs CSV, relatórios PL/SQL, alertas por e-mail.

O Velya parte de outra premissa: **hospital é fluxo de eventos**. Tudo o que acontece com um
paciente — da chegada à alta, da prescrição à cobrança, da higienização do leito à
reconciliação contábil — é um evento imutável num stream único, governado por FHIR R4 como
linguagem clínica e por bounded contexts bem definidos como linguagem operacional.

---

## 2. Os 12 macrodomínios

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VELYA HOSPITAL OS                                 │
│                                                                          │
│  1. Clinical Care       2. Patient Journey     3. Medication            │
│  4. Ancillary Services  5. Patient Support     6. Legal / Audit         │
│  7. Operations          8. Supplies / Pharmacy 9. Revenue Cycle         │
│  10. Access / Roles     11. Interoperability   12. Mobility             │
│                                                                          │
│  ─────────────────────  Event Backbone  ──────────────────────          │
│         NATS JetStream  +  FHIR R4  +  Postgres Event Store             │
│                                                                          │
│  ─────────────────  Observability (OTel) + Policy (OPA)  ────────       │
└──────────────────────────────────────────────────────────────────────────┘
```

Cada macrodomínio é um conjunto de bounded contexts (detalhados em `domain-map.md`). Eles
são autônomos em deploy, schema de dados e evolução, mas compartilham o mesmo event bus,
mesma identidade de paciente e mesma política de autorização.

---

## 3. Arquitetura cloud-native

### 3.1. Princípios

- **Kubernetes-first** — todo workload é um `Deployment`/`StatefulSet` declarativo.
- **GitOps com ArgoCD** — o cluster é um reflexo do repositório `infra/kubernetes`.
- **Imutabilidade** — imagens versionadas por SHA, nunca `latest` em produção.
- **Zero janela de manutenção** — rolling updates com PDB e probes clínicos.
- **Multi-tenant por namespace** — grupo hospitalar -> hospital -> unidade.
- **Dados sensíveis em repouso criptografados** (AES-256) e TLS 1.3 em trânsito.

### 3.2. Componentes principais

| Camada | Componentes |
|---|---|
| Runtime | Kubernetes, Cilium (CNI + eBPF), Istio (mTLS + policy) |
| Persistência | PostgreSQL 16 (por bounded context), Redis, S3-compatible |
| Event bus | NATS JetStream (core), Kafka (analítico opcional) |
| Observabilidade | OpenTelemetry, Prometheus, Loki, Tempo, Grafana |
| Política | Open Policy Agent (OPA) + Rego |
| Secrets | External Secrets + Vault |
| CI/CD | GitHub Actions + ArgoCD |
| Frontend | React + tRPC + Vite |
| Mobile | React Native + Expo EAS |

### 3.3. Padrões arquiteturais

- **Event sourcing** no core clínico e financeiro.
- **CQRS** com projeções materializadas para leitura.
- **Saga** orquestrada para processos longos (reconciliação, alta, faturamento).
- **Outbox** em todos os serviços que escrevem em DB transacional.
- **API Gateway** único com OIDC + rate limiting + audit.

---

## 4. FHIR R4 como espinha dorsal clínica

FHIR não é um "formato de exportação" no Velya. É a linguagem nativa dos agregados clínicos:

- `Patient`, `Encounter`, `Observation`, `Condition`, `MedicationRequest`, `MedicationAdministration`,
  `Procedure`, `DiagnosticReport`, `ServiceRequest`, `CarePlan`, `Task`, `DocumentReference`.
- Agregados internos têm um shape canônico FHIR; projeções geram views específicas
  (ex.: visão de enfermeira, visão de médico, visão de financeiro) sem desnormalização manual.
- Extensões brasileiras (CBHPM, TUSS, SIGTAP, TISS) vivem como `Extension` FHIR sob namespace
  `http://velya.health/fhir/...`.

Detalhes em `docs/interoperability/fhir-and-event-model.md`.

---

## 5. Eventos como backbone

NATS JetStream é o coração operacional:

- **Streams por domínio**: `clinical.*`, `medication.*`, `operations.*`, `revenue.*`.
- **Subject naming**: `<domain>.<aggregate>.<event>.v<version>`, ex.: `medication.prescription.created.v1`.
- **Idempotência** por `event_id` + `dedup_window` de 10 minutos.
- **Durabilidade** configurada por domínio (clínico = `File` + replicação 3).
- **Consumers** push/pull por projeção; back-pressure via `max_ack_pending`.

---

## 6. Agents governados

O Velya usa agents (LLM + regras) como participantes de primeira classe, mas sempre dentro
de um pipeline de governança:

- **Fases formais**: `draft` -> `shadow` -> `active` (ver `docs/agents/...`).
- **Shadow mode** obrigatório com comparação contra humano/baseline.
- **Kill switch** instantâneo por tenant e por agente.
- **Scorecards versionados** — nenhum agente entra em `active` sem scorecard aprovado.
- **Explainability obrigatória** — cada sugestão carrega cadeia de evidências.

---

## 7. Observabilidade nativa

- **Traces** OpenTelemetry cobrem: request HTTP -> comando -> agregado -> evento -> projeção.
- **Métricas RED** (Rate, Errors, Duration) por endpoint e por agregado.
- **Métricas USE** (Utilization, Saturation, Errors) por dependência (DB, NATS, S3).
- **Métricas clínicas** de domínio (ex.: `medication_administration_latency_seconds`).
- **Logs estruturados** em JSON com `patient_id`, `encounter_id`, `trace_id`.
- **Correlação** entre evento clínico, trace e registro contábil em um único dashboard.

Detalhes em `docs/observability/platform-observability-model.md`.

---

## 8. Segurança por design

- **Autenticação**: OIDC com IdP corporativo (Keycloak / Azure AD / ADFS).
- **Autorização**: RBAC + ABAC + ReBAC via OPA.
- **Assinatura digital** ICP-Brasil em documentos clínicos.
- **Break-glass** auditado com notificação síncrona.
- **LGPD**: direitos do titular implementados como comandos (rectify, erase, export).
- **Segregação de tenant** por namespace + network policy + row-level security.

---

## 9. Topologia de deploy

```
            ┌────────────────────────────────┐
            │        Edge / Ingress          │
            │   (NGINX / Istio Gateway)      │
            └──────┬─────────────────────────┘
                   │
     ┌─────────────┴────────────┐
     │   API Gateway (OIDC)     │
     └─────────────┬────────────┘
                   │
      ┌────────────┼────────────────┐
      │            │                │
┌─────┴────┐ ┌─────┴────┐    ┌──────┴─────┐
│ Clinical │ │ Medication│    │ Operations │
│ services │ │ services  │    │ services   │
└─────┬────┘ └─────┬─────┘    └──────┬─────┘
      │            │                  │
      └────────────┼──────────────────┘
                   │
          ┌────────┴────────┐
          │  NATS JetStream │
          └────────┬────────┘
                   │
          ┌────────┴────────┐
          │ Projections /   │
          │ Read Models     │
          └─────────────────┘
```

---

## 10. Roadmap de evolução

- **V1** — Clinical Care + Medication + Revenue + Operations core (paridade funcional mínima).
- **V2** — Agents active em domínios selecionados (triagem, reconciliação, codificação).
- **V3** — Command center mobile + portais paciente/médico externo.
- **V4** — Multi-region ativo-ativo e analytics lakehouse completo.

---

## 11. Referências cruzadas

- `docs/architecture/domain-map.md` — bounded contexts e agregados.
- `docs/architecture/clinical-operational-financial-unification.md` — como os 3 eixos se unem.
- `docs/patient-journey/patient-journey-architecture.md` — o fio condutor do paciente.
- `docs/interoperability/fhir-and-event-model.md` — backbone de dados.
- `docs/observability/platform-observability-model.md` — telemetria.
- `docs/agents/agents-governance-and-improvement-model.md` — governança de IA.
