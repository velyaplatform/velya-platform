# Revenue Cycle e Finanças — Arquitetura

> Arquitetura do ciclo da receita hospitalar do Velya Hospital OS: cadastro, autorização,
> faturamento, glosas e recursos, contabilidade, controladoria, custos por paciente e
> indicadores corporativos.

---

## 1. Escopo

O macrodomínio **Revenue Cycle** cobre o fluxo financeiro completo do paciente, integrado em
tempo real ao clínico/operacional (ver `docs/architecture/clinical-operational-financial-unification.md`).

Bounded contexts:

- `revenue-registration` — cadastro e elegibilidade.
- `revenue-authorization` — autorização prévia (TISS, SUS).
- `revenue-billing` — faturamento de contas hospitalares.
- `revenue-denials` — gestão de glosas e recursos.
- `revenue-accounting` — contabilidade e integração ERP.
- `revenue-costing` — custeio ABC.
- `revenue-kpi` — indicadores corporativos.

---

## 2. Cadastro e elegibilidade

- **Patient registration** cria ou vincula o registro MPI do paciente.
- Dados capturados: identificação, convênio, plano, plano de cobertura, titular,
  responsável financeiro, parentesco, endereço, contatos.
- Verificação de elegibilidade em tempo real:
  - Consulta TISS XML ao convênio (quando suportado).
  - Consulta CNS/SUS.
  - Cache com TTL por operadora.
- Validação de documentos (CPF, RG, CNS).
- Captura de assinatura eletrônica de contratos.

---

## 3. Autorização prévia

Agregado `Authorization`:

- Estados: `requested -> pending -> approved -> denied -> expired -> cancelled`.
- Tipos: ambulatorial, internação, SADT, OPME, quimio, hemodiálise.
- Integração TISS 4.x para convênios.
- SLA monitorado — alertas automáticos em autorizações pendentes próximas do vencimento.
- Anexos (laudos, imagens, justificativas) como `DocumentReference`.
- Histórico completo de interações com a operadora.

---

## 4. Faturamento (billing)

### 4.1. Conta hospitalar como projeção

A `HospitalAccount` **não é digitada** pelo faturamento. Ela é materializada a partir de
eventos clínicos/operacionais que carregam dados de cobrança:

- `DoseAdministered` → lançamento de medicação.
- `ProcedurePerformed` → lançamento de procedimento.
- `ServiceRequestFulfilled` → lançamento de SADT.
- `MaterialConsumed` → lançamento de material.
- `BedAssigned`/`BedReleased` → diárias.
- `SurgeryFinished` → pacote cirúrgico.

Cada lançamento carrega:

- Código TUSS/TISS/SIGTAP.
- Quantidade.
- Valor negociado com o convênio (via `PayerContract`).
- Rastreamento de evento de origem (`sourceEventId`).
- Responsável.

### 4.2. Tabelas e contratos

- `PayerContract` — contrato com operadora com tabelas de preço, regras específicas,
  pacotes, coeficientes, franquias.
- Versionamento semântico dos contratos.
- Simulação de cobrança antes do fechamento.

### 4.3. Fechamento de conta

- Fluxo: `open -> billing -> pending_review -> closed`.
- Checagens automáticas: consistência entre eventos clínicos e lançamentos, cobertura, duplicidade.
- Geração de XML TISS (guias de serviço, SP-SADT, honorário, resumo internação).
- Envio eletrônico via lotes TISS para operadoras.

---

## 5. Gestão de glosas e recursos

### 5.1. Captura de glosa

- Retorno do convênio é recebido via XML TISS.
- Cada glosa vira um evento `DenialRecorded` ligado ao lançamento e à guia.
- Motivo estruturado conforme tabela ANS.

### 5.2. Análise

- Motor de regras por operadora identifica glosas automáticas (ex.: falta de guia,
  procedimento incompatível).
- Fila de análise manual para casos complexos.
- Score de recuperabilidade via agent (em shadow inicialmente).

### 5.3. Recurso

- Agregado `Appeal` com estados formais.
- Captura de argumentação, anexos, respostas do convênio.
- Prazos monitorados com alertas.
- Histórico completo auditável.
- Aprendizado institucional: motivo recorrente gera recomendação para evitar a glosa na
  origem.

---

## 6. Contabilidade

- Eventos financeiros via NATS são consumidos pelo `revenue-accounting`.
- Lançamentos contábeis gerados por regras declarativas (`chart-of-accounts` versionado).
- Integração com ERP (SAP, TOTVS, Oracle) via adapters publicados.
- Conciliação entre conta hospitalar, baixa no convênio e caixa.
- Suporte a BR GAAP e IFRS.

---

## 7. Custos por paciente (ABC)

Custeio baseado em atividades, nativo e em tempo real:

- Cada evento clínico carrega metadados de custo: insumo, labor, overhead.
- Projeções `revenue-costing` agregam por paciente, encounter, DRG, linha de cuidado,
  cirurgião, operadora.
- Variação atribuída ao evento específico.
- Custeio sem lotes noturnos.

### Modelagem

```ts
interface CostAllocation {
  eventId: string;
  patientId: string;
  encounterId: string;
  itemCost: number;       // insumo/material/medicamento
  laborCost: number;      // hh * custo/h por categoria
  overheadShare: number;  // rateio de estrutura
  directCost: number;     // soma
  indirectCost: number;   // rateios corporativos
  totalCost: number;
}
```

---

## 8. Indicadores corporativos

- **Margem** por especialidade, linha de cuidado, operadora, médico.
- **Ticket médio** por tipo de internação.
- **Mix de faturamento**.
- **Giro de contas**.
- **DSO** (Days Sales Outstanding).
- **Glosa bruta e líquida** %.
- **Recuperação de glosa** %.
- **Custo médio por DRG**.
- **LOS vs. média do DRG**.

Todos os KPIs são views materializadas sobre o event store com lineage completo.

---

## 9. Integração com o ciclo clínico

Trabalhando junto com `clinical-operational-financial-unification.md`:

- Cada dose administrada já gera cobrança automaticamente.
- Cada cirurgia executada fecha o pacote cirúrgico no horário real.
- Cada transferência atualiza a diária aplicável.
- Cada exame consumido é cobrado com o código negociado.

Resultado: conciliação noturna entre clínico e financeiro deixa de existir.

---

## 10. Regulamentação brasileira

- **ANS** — normativos TISS.
- **SUS** — SIGTAP, SIHD, SIA.
- **CFM/CFF/COREN** — assinatura profissional em documentos.
- **Receita Federal** — eSocial, EFD.
- **ANVISA** — rastreabilidade de OPME e medicamentos controlados.
- **ONA / JCI** — requisitos de acreditação relacionados ao financeiro.

---

## 11. Auditoria e compliance

- Cada lançamento tem rastro ao evento de origem.
- Estorno é um novo evento, nunca uma exclusão.
- Logs de acesso a dados financeiros sensíveis.
- Segregação de funções (SOD) implementada via RBAC+ABAC.

---

## 12. Controladoria gerencial

- Orçamento como input versionado.
- Comparação real vs. orçado em tempo real.
- Projeções de fechamento mensal via tendência.
- Dashboards por centro de custo.
- Rateios corporativos configuráveis.

---

## 13. Observabilidade

- `revenue_account_open_count`
- `revenue_billing_submission_total{payer="..."}`
- `revenue_denial_rate`
- `revenue_appeal_success_rate`
- `revenue_dso_days`
- `revenue_margin_ratio{specialty="..."}`

---

## 14. Interfaces públicas

- **REST/tRPC** para frontend interno.
- **XML TISS** para operadoras.
- **SFTP/API** para envio a ERP contábil.
- **Open Banking** para conciliação de recebimentos (quando aplicável).

---

## 15. Segurança

- Dados financeiros com criptografia em repouso e em trânsito.
- Segregação de funções em RBAC+ABAC.
- Tokenização de dados de cartão quando aplicável (PCI-DSS escopo reduzido).
- Retenção conforme legislação fiscal.

---

## 16. Referências

- ANS TISS — https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-tiss
- `docs/architecture/clinical-operational-financial-unification.md`
- `docs/architecture/domain-map.md`
- `docs/security/access-audit-signature-model.md`
