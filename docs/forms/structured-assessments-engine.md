# Engine de Formulários e Avaliações Estruturadas

> Arquitetura do motor no-code de formulários estruturados do Velya Hospital OS: escalas
> clínicas (NEWS2, Glasgow, Braden, Morse, dor, Manchester), índices de vulnerabilidade,
> avaliações de confusão e quaisquer protocolos institucionais — versionados, executáveis,
> com gatilhos de fluxo e migração de dados históricos.

---

## 1. Objetivo

Permitir que o time clínico (e não o time de engenharia) crie, versione, publique e
evolua instrumentos de avaliação estruturada, com:

- Cálculo automático de escores.
- Validação de campos.
- Disparo de ações/alertas baseados em resultado.
- Linkagem a eventos do paciente.
- Reprodutibilidade histórica (um formulário versão X pode ser re-renderizado exatamente
  como era).

---

## 2. Exemplos de avaliações cobertas

- **NEWS2** — National Early Warning Score 2
- **Glasgow Coma Scale**
- **Braden** — risco de lesão por pressão
- **Morse Fall Scale** — risco de queda
- **Escala de dor** — EVA, FLACC, BPS
- **Manchester** — triagem
- **CAM-ICU / CAM** — confusão/delirium
- **RASS** — sedação
- **APACHE II, SOFA**
- **PEWS** — pediatric early warning
- **SAE** — Sistematização da Assistência de Enfermagem (NANDA, NIC, NOC)
- **Escalas de vulnerabilidade social e familiar**
- **Checklist pré-cirúrgico (OMS)**

---

## 3. Modelo de dados

### 3.1. Template de formulário (versionado)

```yaml
id: news2
name: National Early Warning Score 2
version: 1.2.0
category: early-warning
appliesTo:
  - patient-age: ">= 16"
fields:
  - id: respRate
    label: Frequência respiratória (irpm)
    type: number
    required: true
    min: 0
    max: 60
  - id: spo2Scale1
    label: SpO2 (%) - Escala 1
    type: number
    required: true
  - id: onOxygen
    label: Em oxigênio suplementar
    type: boolean
  - id: systolicBP
    label: PAS (mmHg)
    type: number
    required: true
  - id: hr
    label: FC (bpm)
    type: number
    required: true
  - id: consciousness
    label: Nível de consciência (ACVPU)
    type: enum
    values: [A, C, V, P, U]
  - id: temp
    label: Temperatura (°C)
    type: number
    required: true
scoring:
  type: weighted-sum
  rules:
    - field: respRate
      buckets:
        - range: "<=8";   score: 3
        - range: "9-11";  score: 1
        - range: "12-20"; score: 0
        - range: "21-24"; score: 2
        - range: ">=25";  score: 3
    # ... demais campos
outputs:
  - id: totalScore
    expression: sum(scores)
  - id: riskLevel
    expression: |
      totalScore >= 7 ? "high"
      : totalScore >= 5 ? "medium"
      : totalScore >= 1 ? "low"
      : "none"
actions:
  - when: riskLevel == "high"
    do:
      - notify: rapid-response-team
      - createTask: clinical-review-urgent
      - raiseAlert: code-yellow
  - when: riskLevel == "medium"
    do:
      - notify: attending-physician
      - scheduleReassessment: 60min
```

### 3.2. Submissão

Cada preenchimento é um evento:

```json
{
  "eventType": "assessment.submitted.v1",
  "templateId": "news2",
  "templateVersion": "1.2.0",
  "patientId": "pt-1042",
  "encounterId": "enc-9911",
  "performer": "prof-4421",
  "submittedAt": "2026-04-09T14:00:00Z",
  "values": { "respRate": 22, "spo2Scale1": 94, "onOxygen": true, "systolicBP": 110, "hr": 115, "consciousness": "A", "temp": 37.8 },
  "computed": { "totalScore": 6, "riskLevel": "medium" }
}
```

---

## 4. Versionamento

- Templates seguem **SemVer** (`major.minor.patch`).
- **Patch**: correção de typo, label, texto de ajuda.
- **Minor**: novo campo opcional, nova ação.
- **Major**: mudança de campo obrigatório, mudança de scoring — incompatível.
- Templates em estado `draft` podem ser testados em sandbox.
- Templates `published` são imutáveis — correções viram novas versões.
- Templates `deprecated` seguem funcionando para leitura mas não podem receber novas
  submissões.

Um paciente pode ter submissões de várias versões do mesmo template ao longo do tempo. A
reconstrução histórica usa exatamente a versão em que a submissão foi feita.

---

## 5. Migrações de dados históricos

Quando um template passa de v1 para v2 com quebra de schema:

- Define-se um **upcaster** declarativo: `v1.values -> v2.values`.
- A projeção read-only aplica o upcaster ao reconstruir.
- Submissões antigas **não são reescritas no event store** — permanecem como estavam.
- Queries analíticas usam a versão normalizada via upcaster.

---

## 6. Gatilhos de fluxo (workflow triggers)

Ações declaradas em `actions` são executadas pelo serviço `form-action-dispatcher`:

- `notify` — notificação para pessoa/equipe/canal.
- `createTask` — cria tarefa no contexto `clinical-care`.
- `raiseAlert` — evento de alerta assistencial.
- `scheduleReassessment` — agenda reavaliação no template com tempo parametrizável.
- `orderExam` — cria `ServiceRequest` (com confirmação do médico).
- `callCodeBlue/Yellow` — aciona time de resposta rápida.
- `lockDose` — bloqueia doses seguintes de medicação até reavaliação.

Toda ação é auditada e reversível (quando aplicável).

---

## 7. Renderização

- **Web**: componente React que recebe o template e renderiza campos dinamicamente.
- **Mobile**: mesmo template, renderer React Native.
- Componentes por tipo: `text`, `number`, `enum`, `boolean`, `date`, `time`, `signature`,
  `photo`, `scale` (slider), `table` (matriz), `section`.
- Acessibilidade WCAG 2.1 AA obrigatória.
- Offline-first em mobile com fila de sync.

---

## 8. Validação

- Validação no cliente (imediata) + servidor (autoritativa).
- Regras de cross-field (ex.: se `onOxygen=true`, exigir `oxygenFlow`).
- Mensagens de erro em pt-BR.
- Validação de consistência temporal (ex.: não aceitar NEWS2 com timestamp futuro).

---

## 9. Integração com o journey

- Toda submissão vira um evento `assessment.submitted.*` consumido pelo journey.
- Projeções por persona exibem avaliações relevantes.
- Reconstrução temporal considera a versão do template vigente na hora da submissão.

---

## 10. Integração com agents clínicos

Agents podem:

- **Pré-preencher** campos a partir de sinais vitais já registrados (com confirmação humana).
- **Sugerir** reavaliação baseada em tendência (ex.: NEWS2 subiu 2 pontos em 1h).
- **Detectar discrepâncias** entre avaliações consecutivas sem evolução clínica correspondente.

Sempre em modo supervisionado (ver `docs/agents/...`).

---

## 11. SAE — Sistematização da Assistência de Enfermagem

- NANDA (diagnósticos), NIC (intervenções), NOC (resultados) como taxonomias embutidas.
- Templates SAE pré-configurados por especialidade.
- Histórico de raciocínio clínico como evolução estruturada.

---

## 12. Observabilidade

- `assessment_submitted_total{template="...", version="..."}`
- `assessment_score_distribution{template="..."}`
- `assessment_action_triggered_total{action="..."}`
- `assessment_render_latency_ms`
- Dashboards por especialidade.

---

## 13. Governança de templates

- Templates têm **dono clínico** (comissão institucional).
- Mudanças passam por revisão em PR no repositório de templates.
- Deploy de templates é separado do deploy de código — GitOps dedicado.
- Histórico completo de mudanças via git.

---

## 14. Segurança

- Acesso a templates controlado por perfil.
- Submissões carregam assinatura do performer.
- Alteração de submissão já assinada é vedada; correção é uma nova submissão ligada à anterior.

---

## 15. Roadmap

- Biblioteca pública de templates brasileiros certificados.
- Editor visual drag-and-drop para comissões clínicas.
- Tradução automática para pt-BR / en-US.
- Exportação para FHIR `Questionnaire` + `QuestionnaireResponse`.

---

## 16. Referências

- FHIR Questionnaire: https://www.hl7.org/fhir/R4/questionnaire.html
- FHIR QuestionnaireResponse: https://www.hl7.org/fhir/R4/questionnaireresponse.html
- NEWS2 — Royal College of Physicians.
- Braden, Morse, Glasgow — manuais originais.
- NANDA-I, NIC, NOC.
