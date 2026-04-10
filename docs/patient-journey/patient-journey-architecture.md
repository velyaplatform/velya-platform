# Patient Journey — Arquitetura Técnica

> Arquitetura do Patient Journey do Velya Hospital OS baseada em Event Sourcing + CQRS,
> com projeções materializadas por persona e reconstrução temporal completa.

---

## 1. Objetivo

Entregar uma timeline única, confiável, em tempo real e temporalmente reconstruível do
paciente, com views específicas por persona (médico, enfermagem, farmácia, financeiro,
paciente, auditor) sobre os mesmos eventos de base.

---

## 2. Princípios

- **Event sourcing** como fonte de verdade.
- **CQRS** com projeções por persona.
- **Reconstrução temporal** — dado qualquer `timestamp`, é possível reconstruir o estado do
  paciente naquele instante exato.
- **Imutabilidade** — eventos nunca são alterados; correções são novos eventos.
- **Acesso controlado** — cada persona vê apenas as projeções autorizadas.
- **Observabilidade nativa** — cada projeção expõe métricas RED.

---

## 3. Modelo de eventos

Os eventos do journey vêm de todos os bounded contexts (ver `domain-map.md`). O journey não
emite eventos próprios — ele é um **consumidor privilegiado** com seus próprios consumers
durable no NATS JetStream.

Envelope canônico:

```json
{
  "eventId": "01HXYZ...",
  "eventType": "medication.administration.administered.v1",
  "occurredAt": "2026-04-09T14:32:10Z",
  "recordedAt": "2026-04-09T14:32:10.231Z",
  "patientId": "pt-1042",
  "encounterId": "enc-9911",
  "actor": { "type": "professional", "id": "prof-4421", "role": "nurse" },
  "tenantId": "hosp-abc",
  "payload": { "..." },
  "causation": { "commandId": "cmd-..." },
  "correlation": { "traceId": "..." }
}
```

Campos chave:

- `occurredAt` — momento clínico real do fato.
- `recordedAt` — momento em que o sistema recebeu.
- `patientId` — pivô de partição.
- `causation` + `correlation` — rastreabilidade completa.

---

## 4. Event store

- **Tecnologia**: PostgreSQL 16 com tabela append-only `journey_events` + índices por
  `patient_id`, `occurred_at`, `event_type`.
- **Retention**: ilimitada por política clínica/regulatória (mínimo 20 anos prontuário).
- **Particionamento**: por `tenant_id` e janela temporal (mensal).
- **Backup**: WAL streaming + snapshots diários + verificação de integridade (hash por
  partição).
- **Replicação para NATS**: via CDC (outbox) para consumers downstream.

### Schema simplificado

```sql
CREATE TABLE journey_events (
  tenant_id      text not null,
  event_id       text primary key,
  patient_id     text not null,
  encounter_id   text,
  event_type     text not null,
  occurred_at    timestamptz not null,
  recorded_at    timestamptz not null default now(),
  actor          jsonb not null,
  payload        jsonb not null,
  causation      jsonb,
  correlation    jsonb,
  schema_version int not null
);

CREATE INDEX idx_je_patient_time ON journey_events (tenant_id, patient_id, occurred_at);
CREATE INDEX idx_je_type ON journey_events (tenant_id, event_type, occurred_at);
```

---

## 5. CQRS e projeções por persona

Cada persona consome os mesmos eventos mas produz uma projeção dedicada, otimizada para sua
leitura. Projeções são **view models** materializadas em tabelas próprias, reconstruíveis a
qualquer momento.

### Projeções existentes

| Projeção | Persona | Conteúdo |
|---|---|---|
| `journey_physician_view` | Médico | Problemas ativos, medicação, resultados críticos, notas recentes |
| `journey_nursing_view` | Enfermagem | SAE, sinais vitais, aprazamentos, intercorrências |
| `journey_pharmacy_view` | Farmácia | Plano terapêutico, reconciliação pendente, intervenções |
| `journey_billing_view` | Financeiro | Lançamentos, autorizações, glosas, status da conta |
| `journey_patient_view` | Paciente | Versão simplificada, linguagem leiga, sem dados sensíveis de terceiros |
| `journey_auditor_view` | Auditor | Trilha completa com metadados de compliance |
| `journey_command_center_view` | Gestão | KPIs operacionais do paciente (LOS, ocupação, carga) |

### Contrato de projeção

Cada projeção implementa:

```ts
interface Projection<Event, ReadModel> {
  name: string;
  version: string;               // semver; bump invalida projeção
  apply(state: ReadModel, ev: Event): ReadModel;
  canHandle(ev: Event): boolean;
  rebuild(from: Date): Promise<void>;
}
```

Projeções são **idempotentes**: aplicar o mesmo evento duas vezes não altera o read model.

---

## 6. Reconstrução temporal

A API do journey permite consultas com um parâmetro `asOf`:

```
GET /patients/pt-1042/journey?asOf=2026-04-09T10:00:00Z
```

Implementação:

1. Seleciona todos os eventos com `occurred_at <= asOf` e `recorded_at <= asOf` (opcional,
   para distinguir "o que sabíamos naquele momento" vs. "o que aconteceu até aquele momento").
2. Aplica-os a uma projeção efêmera.
3. Retorna o read model reconstruído.

Usos típicos:

- Auditoria e processos judiciais ("o que estava registrado no momento X?").
- Pesquisa clínica retrospectiva.
- Análise de eventos adversos (RCA — root cause analysis).
- Reproduzir bugs em produção para debug.

### Diferença entre `occurredAt` e `recordedAt`

Exemplo: um médico registra às 10h uma observação que **ocorreu** às 8h. Se alguém consultar
o journey "como o sistema estava às 9h", a observação não deve aparecer, embora seu
`occurredAt` seja 8h. A dupla marcação permite essa distinção bi-temporal.

---

## 7. Correções e rescisões

Eventos nunca são alterados. Correções são novos eventos específicos:

- `ObservationCorrected` — aponta para o evento original via `causation.correctsEventId`.
- `EventRescinded` — marca um evento como "não deveria ter sido gravado" (erro operacional),
  mas preserva a história.

A projeção atual filtra eventos rescindidos, mas auditores conseguem vê-los.

---

## 8. Consistência e lag de projeção

- **Consistência eventual** entre event store e projeções.
- **SLO de lag**: p99 < 500 ms para projeções críticas (physician, nursing, command-center).
- **Métrica exposta**: `journey_projection_lag_seconds{projection="..."}`.
- **Alerta**: lag > 2 s por mais de 30 s dispara incidente.
- **Fallback**: em caso de lag severo, UI indica explicitamente "dados com atraso" em vez de
  mostrar estado inconsistente silenciosamente.

---

## 9. Políticas de acesso por projeção

Cada projeção tem uma política OPA associada:

```rego
package journey.physician_view

default allow = false

allow {
  input.subject.role == "physician"
  input.subject.id == input.resource.attendingPhysicianId
}

allow {
  input.subject.role == "physician"
  some team in input.subject.teams
  team == input.resource.careTeamId
}
```

Acesso fora do escopo requer break-glass (ver `docs/security/...`).

---

## 10. API pública

- **REST/FHIR**: `GET /Patient/{id}/$everything?asOf=...` — retorna FHIR Bundle.
- **tRPC**: `journey.get({ patientId, persona, asOf })` — tipado para o frontend.
- **GraphQL** (opcional): para apps mobile com necessidade de query flexível.
- **Streaming**: `subscribe journey:pt-1042` via WebSocket/SSE para atualizações ao vivo.

---

## 11. Observabilidade do journey

Métricas específicas:

- `journey_events_appended_total{type="..."}`
- `journey_projection_apply_duration_seconds{projection="..."}`
- `journey_projection_lag_seconds{projection="..."}`
- `journey_rebuild_duration_seconds{projection="..."}`
- `journey_asof_query_duration_seconds`

Traces:

- Spans cobrem: comando -> agregado -> evento -> append -> NATS -> consumer -> projeção.

---

## 12. Rebuild operacional

Rebuild completo de uma projeção:

1. Cria tabela nova `journey_physician_view_v2`.
2. Consumer replay desde o início do event store.
3. Monitoramento de progresso via `journey_rebuild_progress`.
4. Cutover atômico via swap de view SQL.
5. Projeção antiga mantida por 7 dias para rollback.

---

## 13. Segurança dos dados

- Event store criptografado em repouso.
- Campos PII marcados com tags para mascaramento em projeções de auditoria externa.
- Projeções podem ter TTL (ex.: portal do paciente expira histórico > 5 anos para UX, mas
  event store mantém tudo).

---

## 14. Integração com FHIR

- Cada evento pode ser traduzido para um recurso FHIR via mapeamento `event -> FHIR resource`.
- A projeção `journey_fhir_view` materializa o paciente como Bundle FHIR R4 completo.
- Clientes externos usam essa projeção via endpoint `$everything`.

---

## 15. Limitações conhecidas

- Consultas `asOf` muito antigas em pacientes longevos podem ser custosas — usar snapshots.
- Rebuild de projeção gigante pode levar horas — mitigado por paralelismo por partição.
- Mudanças de schema de evento requerem upcasters versionados.

---

## 16. Referências

- `docs/architecture/velya-hospital-platform-overview.md`
- `docs/architecture/domain-map.md`
- `docs/architecture/clinical-operational-financial-unification.md`
- `docs/interoperability/fhir-and-event-model.md`
- `docs/observability/platform-observability-model.md`
