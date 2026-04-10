# Revenue Cycle e Fluxos Administrativos

> **Escopo:** do cadastro inicial do paciente até o recebimento do pagamento (e análise de custos). Revenue cycle é o "sistema nervoso financeiro" do hospital.

---

## 1. Princípio

Um hospital perde mais dinheiro em falhas de processo administrativo (glosas, falta de autorização, documentação incompleta) do que em ineficiência clínica. O Velya trata o revenue cycle como um **fluxo de primeira classe**, com trace, SLOs e observabilidade.

---

## 2. As 10 Etapas do Ciclo

```
[1] Cadastro
[2] Pré-autorização
[3] Check-in / Admissão
[4] Registro de serviços prestados
[5] Codificação
[6] Montagem da conta
[7] Faturamento / envio ao pagador
[8] Análise de glosas
[9] Recurso e contestação
[10] Recebimento e conciliação
```

---

## 3. Etapa 1 — Cadastro

### 3.1 Dados obrigatórios
- Nome completo, DN, CPF, RG, CNS, mãe, endereço, contato.
- Plano de saúde, carteirinha, validade, vínculo (titular/dependente).
- Acompanhante e contato de emergência.
- Alergias conhecidas.
- Consentimento LGPD.

### 3.2 Validações
- Duplicidade (busca por CPF, nome, DN).
- Validade do plano.
- Cobertura do procedimento.
- Carências.

### 3.3 Estado
- `patient.registered = true`
- `account.status = REGISTERED`

---

## 4. Etapa 2 — Pré-autorização

### 4.1 Quando
- Procedimentos eletivos.
- Internações programadas.
- SADT de alto custo (TC, RM, PET-CT).
- OPME.
- Quimioterapia.

### 4.2 Fluxo
1. Solicitação do médico com justificativa clínica.
2. Envio ao convênio (TISS 3.0+ via SS/B2B).
3. Resposta: autorizado, pendente, negado.
4. Recurso automatizado em caso de negativa injustificada.
5. Registro da senha de autorização.

### 4.3 SLA
- Autorização eletiva: ≤ 48h antes do procedimento.
- Urgência: ≤ 2h.
- Emergência: autorizado retrospectivamente.

### 4.4 Risco
Sem autorização, o hospital realiza o cuidado **por dever assistencial**, mas pode enfrentar glosa total.

---

## 5. Etapa 3 — Check-in / Admissão

### 5.1 Ações
- Conferência de dados cadastrais.
- Conferência da autorização.
- Abertura da conta (account).
- Pulseira de identificação.
- Consentimento do atendimento.
- TCLE (termo de consentimento livre e esclarecido).

### 5.2 Conta do paciente
- `account_id`
- `encounter_id`
- `payer_type` (convênio, SUS, particular, misto)
- `authorization_number`
- `cost_center`

---

## 6. Etapa 4 — Registro de Serviços Prestados

### 6.1 O que é registrado
- Diárias (enfermaria, UTI, semi-intensivo).
- Honorários médicos (por procedimento).
- Taxas (sala cirúrgica, sala de exame).
- Materiais e medicamentos consumidos.
- OPME.
- Exames (lab, imagem).
- Anestesia.
- Gasoterapia (O₂, cilindros).
- Hemoderivados.

### 6.2 Registro no ponto de uso
- Cada consumo é debitado **no momento do uso** (barcode scan).
- Evita perdas por esquecimento.
- Rastreável em trace.

### 6.3 Integração
- Clínico ↔ faturamento em tempo real.
- Prontuário eletrônico ↔ conta do paciente.

---

## 7. Etapa 5 — Codificação

### 7.1 Códigos
- **CID-10 / CID-11:** diagnóstico principal e secundários.
- **TUSS:** procedimentos, materiais, medicamentos (Brasil).
- **CBHPM:** referência de honorários (Brasil).
- **SIGTAP:** SUS.
- **AMB:** referência histórica.
- **DRG / GRC:** agrupamento por complexidade.

### 7.2 Fluxo
- Codificação sugerida automaticamente por NLP sobre o prontuário.
- Revisão humana por codificador clínico.
- Aprovação final.

---

## 8. Etapa 6 — Montagem da Conta

### 8.1 Checagens pré-fechamento
- Autorização em mãos.
- Documentação obrigatória presente (evolução, prescrição, relatório cirúrgico, laudo de anestesia, laudo de imagem).
- Ausência de divergência (ex: medicamento prescrito mas não administrado).
- Completude dos códigos.

### 8.2 Pré-auditoria interna
- Análise por auditoria de contas.
- Correções antes do envio.
- Reduz taxa de glosa.

### 8.3 Fechamento
- Conta fecha oficialmente.
- Envio ao pagador.

---

## 9. Etapa 7 — Faturamento / Envio ao Pagador

### 9.1 Modelos
- **Convênio:** TISS (padrão obrigatório ANS).
- **SUS:** BPA, APAC, AIH.
- **Particular:** nota fiscal direta.

### 9.2 SLA
- Envio ao convênio em ≤ 10 dias da alta.
- DSO (days sales outstanding) alvo: ≤ 60 dias.

---

## 10. Etapa 8 — Glosas

### 10.1 Tipos
- **Administrativa:** falta de autorização, identificação errada, código inválido.
- **Técnica:** divergência clínica (indicação, quantidade, tempo).
- **Contratual:** fora da cobertura do contrato.
- **Médica:** questionamento da equipe médica do convênio.

### 10.2 Análise
- Recebimento de relatório de glosa do pagador.
- Segregação por tipo.
- Alocação para analistas específicos.
- Análise caso a caso.

### 10.3 Métricas críticas
- **Glosa primária:** % glosada na primeira análise.
- **Glosa líquida:** % não recuperada após recursos.
- Meta: glosa líquida < 2%.

---

## 11. Etapa 9 — Recurso

### 11.1 Processo
- Preparo do recurso com evidências (prontuário, protocolos, guidelines).
- Envio formal ao pagador.
- Acompanhamento do prazo de resposta.
- Arbitragem se necessário (ANS/judicial).

### 11.2 SLA
- Recurso em ≤ 30 dias da glosa.

---

## 12. Etapa 10 — Recebimento e Conciliação

### 12.1 Recebimento
- Repasse do pagador.
- Guia de pagamento.
- Conciliação com conta fechada.

### 12.2 Conciliação
- Valor esperado vs valor pago.
- Diferenças analisadas.
- Novos recursos se cabível.

### 12.3 Fim do ciclo
- Conta quitada.
- Repasses médicos (honorários) calculados e pagos.
- Custos fechados.

---

## 13. Custos — Visão Paralela

Paralelo ao faturamento, o hospital calcula **custos reais**:

### 13.1 Modelos
- **Absorção:** rateio de custos indiretos.
- **ABC (Activity-Based Costing):** custo por atividade.
- **TDABC (Time-Driven ABC):** custo por tempo gasto.
- **Custo por paciente:** soma direta + rateio.

### 13.2 Centro de custo
- Cada unidade tem `cost_center_id`.
- Cada consumo é alocado ao centro de custo certo.
- Relatórios mensais.

### 13.3 Margem
- Receita − custo = margem por paciente/procedimento/unidade/convênio.
- Análise de rentabilidade por service line.

---

## 14. Fluxos Administrativos Adjacentes

### 14.1 Compras
- Requisição → cotação → homologação → ordem de compra → recebimento → pagamento.

### 14.2 Recursos Humanos
- Admissão → treinamento → escala → folha → desligamento.

### 14.3 Contas a Pagar
- Fornecedores → aprovação → agendamento → pagamento.

### 14.4 Tesouraria
- Fluxo de caixa diário.
- Conciliação bancária.

### 14.5 Qualidade
- Não-conformidades.
- Auditoria interna.
- Acreditação (ONA, JCI).

### 14.6 Ouvidoria
- Manifestações do paciente.
- Classificação (elogio, sugestão, reclamação).
- Tratativa e resposta.

---

## 15. Métricas Globais do Revenue Cycle

| Métrica | Meta |
|---|---|
| Taxa de cadastro com erro | < 1% |
| Taxa de pré-autorização negada | < 5% |
| Tempo alta → conta fechada | ≤ 3 dias |
| Tempo alta → faturamento | ≤ 10 dias |
| DSO | ≤ 60 dias |
| Glosa primária | < 8% |
| Glosa líquida | < 2% |
| Taxa de recuperação de glosa | ≥ 75% |
| Inadimplência | < 3% |
| Margem por paciente (alvo por service line) | definido por gestão |

---

## 16. Observabilidade do Revenue Cycle

- Cada etapa tem span no trace clínico-financeiro unificado.
- Alertas:
  - Conta aberta há > 30 dias sem alta.
  - Conta fechada há > 15 dias sem envio.
  - Glosa sem tratativa há > 10 dias.
  - Autorização vencendo em 24h sem uso.
- Dashboards específicos (ver `command-centers-and-dashboards.md`).
- Aprendizado: taxa de glosa por procedimento alimenta o CDS para alertar a equipe clínica sobre documentação faltante no momento do atendimento.
