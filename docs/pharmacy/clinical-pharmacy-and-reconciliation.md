# Farmácia Clínica e Reconciliação Medicamentosa

> Arquitetura do bounded context de farmácia clínica no Velya Hospital OS: revisão do plano
> terapêutico, validação farmacêutica, análise de dose/diluição/interações, reconciliação
> medicamentosa nas transições de cuidado e intervenções farmacêuticas.

---

## 1. Escopo

O contexto `pharmacy-clinical-review` + `pharmacy-reconciliation` cobre:

- Revisão do plano terapêutico completo do paciente.
- Validação farmacêutica de cada prescrição.
- Análise de dose, diluição, via, compatibilidade, custo-efetividade.
- Reconciliação na admissão, transferência e alta.
- Registro e acompanhamento de intervenções farmacêuticas.
- Relatório de boas práticas (ISMP, SBRAFH).

---

## 2. Revisão do plano terapêutico

A fila de revisão é uma projeção priorizada sobre `MedicationPrescribed`:

- **Prioridade** calculada por um agent `pharmacy-priority-scorer`:
  - Alto risco: quimioterápicos, anticoagulantes, insulinas, antibióticos de uso restrito.
  - Pacientes críticos (UTI, pediatria, obstetrícia).
  - Prescrições com alertas de segurança ativos.
- **SLA por prioridade**:
  - P1: 10 minutos
  - P2: 30 minutos
  - P3: 2 horas
- **Atribuição**: automática por carga e competência do farmacêutico.

### Estados da revisão

```
received -> analyzing -> { approved | approved_with_intervention | rejected | escalated }
```

Cada transição é um evento:

- `PrescriptionReviewStarted`
- `PrescriptionReviewCompleted`
- `PharmacyInterventionRecorded`
- `PrescriptionEscalated`

---

## 3. Validação farmacêutica — checklist digital

Ao receber a prescrição, o farmacêutico executa um checklist estruturado (no-code,
versionado):

- Identificação do paciente.
- Condições clínicas pertinentes (função renal, hepática, peso, gravidez).
- Alergias e histórico de reações.
- Medicamento apropriado para indicação.
- Dose dentro da faixa terapêutica.
- Ajuste de dose por clearance.
- Via de administração adequada.
- Frequência e duração.
- Diluente e volume corretos.
- Velocidade de infusão.
- Incompatibilidades Y-site.
- Tempo de infusão.
- Fotoproteção, refrigeração, etc.
- Duplicidade terapêutica.
- Custo-efetividade (trocas por genérico/similar).

O checklist é definido em YAML, versionado, e renderizado automaticamente na UI.

---

## 4. Base de conhecimento

- **Interações**: base própria + Micromedex/Uptodate via licença.
- **Dose**: UpToDate Lexi-Drugs, BCB, Bulário ANVISA.
- **Diluições**: Trissel + manuais institucionais.
- **Compatibilidade Y-site**: Trissel.
- **Estabilidade pós-preparo**: manuais do fabricante.

Cada recomendação exibida carrega a **fonte** e **evidência** — o farmacêutico nunca vê um
alerta sem explicação.

---

## 5. Intervenções farmacêuticas

Uma intervenção é um fato estruturado:

```json
{
  "eventType": "pharmacy.intervention.recorded.v1",
  "prescriptionId": "rx-3310",
  "type": "dose-adjustment",
  "severity": "high",
  "description": "Ajuste de dose de vancomicina por ClCr 25 mL/min",
  "acceptedBy": { "prescriberId": "prof-1001", "at": "2026-04-09T15:20:10Z" },
  "outcome": "accepted",
  "savings": { "cost": 128.40, "risk": "nephrotoxicity-avoidance" }
}
```

Tipos de intervenção (taxonomia padronizada):

- Ajuste de dose
- Troca de medicamento
- Suspensão
- Adição de medicamento
- Correção de via
- Correção de frequência
- Ajuste de diluição
- Orientação ao prescritor
- Orientação ao paciente/família

Outcomes: `accepted`, `partially_accepted`, `rejected`, `pending`.

---

## 6. Reconciliação medicamentosa

### 6.1. Tipos

- **Admissão**: coleta de medicamentos domiciliares e comparação com prescrição hospitalar.
- **Transferência**: comparação entre setores (UTI -> enfermaria, enfermaria -> SO).
- **Alta**: comparação entre prescrição hospitalar e receita de alta.

### 6.2. Processo

```
start -> collect -> analyze -> decide -> complete
```

1. **Coleta (BPMH — Best Possible Medication History)**
   - Entrevista ao paciente/família.
   - Consulta a farmácias externas (quando integradas).
   - Histórico do próprio hospital (via journey).
   - Medicamentos trazidos de casa conferidos.

2. **Análise**
   - Comparação linha a linha com a prescrição ativa.
   - Identificação de discrepâncias:
     - Omissão
     - Comissão (medicamento novo sem justificativa)
     - Dose diferente
     - Via diferente
     - Frequência diferente
   - Classificação da discrepância: intencional (documentada) vs. não intencional (erro).

3. **Decisão**
   - Cada discrepância não intencional vira uma intervenção.
   - Intervenção é enviada ao prescritor via fila priorizada.

4. **Conclusão**
   - Caso fechado quando todas as discrepâncias têm decisão.
   - Evento `ReconciliationCompleted` carrega o resumo.

### 6.3. Modelagem

```ts
interface ReconciliationCase {
  id: string;
  type: 'admission' | 'transfer' | 'discharge';
  patientId: string;
  encounterId: string;
  bpmh: MedicationEntry[];          // medicamentos de origem
  active: MedicationEntry[];        // prescrição ativa no hospital
  discrepancies: Discrepancy[];
  state: 'started' | 'collecting' | 'analyzing' | 'decided' | 'completed';
  startedAt: Date;
  completedAt?: Date;
  performedBy: string;              // farmacêutico
}
```

---

## 7. Reconciliação na alta

Etapa crítica com requisitos específicos:

- Receita de alta gerada em linguagem do paciente.
- Horários em linguagem natural ("manhã, tarde, noite").
- Lista de medicamentos suspensos com motivo.
- Orientação escrita e verbal.
- Assinatura do farmacêutico orientador.
- Disponível no portal do paciente.

---

## 8. Integração com o closed-loop

- Toda nova prescrição entra na fila.
- Administrações pendentes são monitoradas: se administração passa da janela por mais que X
  minutos sem justificativa, um alerta é gerado.
- Eventos adversos com temporalidade compatível são linkados automaticamente à medicação.

---

## 9. Indicadores

- Taxa de prescrições revisadas no SLA.
- Taxa de intervenções aceitas.
- Economia gerada por intervenções.
- Discrepâncias por paciente na reconciliação.
- Tempo médio de reconciliação por tipo.
- Near-miss detectados antes de chegar ao paciente.

---

## 10. Regulamentação e boas práticas

- **SBRAFH** — Sociedade Brasileira de Farmácia Hospitalar.
- **ISMP Brasil** — Institute for Safe Medication Practices.
- **ANVISA** — RDC 585/2021 (farmácia clínica).
- **ONA/JCI** — requisitos de acreditação.
- **CFF** — Resolução 585/2013 (atribuições do farmacêutico clínico).

---

## 11. Governança de agents farmacêuticos

O Velya pode usar agents para sugerir intervenções, mas apenas em modo **shadow** inicialmente:

- `pharmacy-interaction-detector` — detecta interações adicionais à base.
- `pharmacy-dose-suggester` — sugere ajustes por função renal.
- `pharmacy-reconciliation-assistant` — pré-preenche BPMH a partir de integrações.

Todo agent segue o pipeline `draft -> shadow -> active` descrito em
`docs/agents/agents-governance-and-improvement-model.md`.

---

## 12. Referências

- `docs/medication/closed-loop-medication-architecture.md`
- `docs/architecture/domain-map.md`
- `docs/agents/agents-governance-and-improvement-model.md`
- ISMP Brasil — Boletim de Boas Práticas.
- IHMA — Medication Reconciliation Guidelines.
