# Agents — Governança, Ciclo de Vida e Modelo de Melhoria Contínua

> Modelo de governança de agents (LLMs + regras) no Velya Hospital OS: fases formais
> (draft -> shadow -> active), validação em cadeia, watchdogs, kill switches, scorecards,
> melhoria contínua e aprendizado com erros.

---

## 1. Princípios

- **Agents são participantes de primeira classe**, não features ocultas.
- **Nenhum agent age em produção sem governança explícita.**
- **Humano no loop** por default em tudo que toca paciente.
- **Explainability obrigatória** — cada sugestão carrega cadeia de evidências.
- **Kill switch instantâneo** por agent, por tenant, por contexto.
- **Scorecard versionado** como pré-requisito para mudança de fase.
- **Telemetria e auditoria** indistinguíveis de qualquer outro serviço crítico.

---

## 2. Definição de agent no Velya

Um **agent** é um componente autônomo que observa eventos, aplica raciocínio (LLM, regras,
ML) e produz uma recomendação, decisão ou ação dentro de um contrato bem definido.

Tipos:

- **Informativo** — apenas sugere, nunca age. Ex.: `pharmacy-interaction-detector`.
- **Recomendatório** — sugere para o humano. Ex.: `triage-priority-assistant`.
- **Assistente** — executa ações de baixo risco com confirmação humana. Ex.: `note-summarizer`.
- **Autônomo** — executa ações automáticas num escopo restrito com rollback fácil.
  Apenas em domínios não críticos (ex.: agendamento administrativo de housekeeping).

O Velya **não** tem agents autônomos em prescrição, administração ou decisão clínica direta.

---

## 3. Ciclo de vida — fases formais

```
 draft ──▶ shadow ──▶ active ──▶ retired
   ▲         │           │
   │         └───────────┤
   │                     ▼
   └──── rollback ◀──── incident
```

### 3.1. Draft

- Desenvolvimento em ambiente isolado.
- Testes unitários e de integração.
- Avaliação contra datasets sintéticos e casos históricos.
- Nenhum contato com produção.
- Pull request obrigatório com revisão clínica + técnica.

### 3.2. Shadow

- Agent recebe eventos de produção **em tempo real**, mas **não toma ação**.
- Compara decisões com baseline (humano ou regra prévia).
- Gera telemetria completa: inputs, outputs, diferenças.
- Duração mínima configurável por tipo de agent (ex.: 4 semanas ou 10k decisões, o maior).
- Revisão semanal de discrepâncias por comitê clínico.

### 3.3. Active

- Agent atua em produção conforme seu tipo (informativo / recomendatório / assistente / autônomo).
- Scorecard obrigatório aprovado no go-live.
- Watchdog contínuo.
- Kill switch sempre disponível.
- Revisão periódica de performance.

### 3.4. Retired

- Agent é desligado (nova versão, mudança de estratégia, baixa performance).
- Histórico preservado no event store.
- Decisões anteriores permanecem auditáveis.

---

## 4. Validação em cadeia (validation chain)

Antes de qualquer sugestão chegar ao humano ou virar ação, ela passa por uma cadeia de
validadores independentes:

```
raw output
  -> schema validator
  -> safety filter (regras de segurança clínica)
  -> policy check (OPA)
  -> bias / fairness check (quando aplicável)
  -> explainability enricher
  -> final recommendation
```

Qualquer etapa pode vetar a saída — e o veto é auditado.

---

## 5. Watchdogs

Watchdogs monitoram agents em tempo real:

- **Drift watchdog** — distribuição de decisões muda significativamente vs. baseline.
- **Latency watchdog** — resposta excede SLO.
- **Cost watchdog** — consumo de tokens excede orçamento.
- **Safety watchdog** — taxa de decisões "bloquear" sobe acima do esperado.
- **Agreement watchdog** — concordância com humanos cai.

Qualquer watchdog pode disparar alerta, escalar ou acionar o kill switch automaticamente
conforme política.

---

## 6. Kill switches

- Disponível por **agent**, por **tenant**, por **contexto**.
- Ativado por:
  - Operação (SRE / on-call).
  - Comitê clínico.
  - Watchdog (automático, com threshold explícito).
  - DPO (em caso de incidente de privacidade).
- Ativação emite evento auditado `AgentKillSwitchActivated` com motivo.
- Recuperação exige revisão + aprovação formal.

---

## 7. Scorecards

Cada agent tem scorecard versionado:

### 7.1. Métricas típicas

- **Precision** / **Recall** / **F1** (quando há ground truth).
- **Agreement rate** com humanos.
- **Time saved** médio por decisão.
- **Intervention acceptance rate**.
- **Near-miss detected**.
- **False positive rate** (alertas ignorados).
- **False negative rate** (casos não sinalizados).
- **Latency** p50/p95/p99.
- **Cost per decision**.
- **Fairness metrics** por grupo populacional quando aplicável.

### 7.2. Aprovação

- Scorecard versionado em YAML no repositório do agent.
- Versão do scorecard amarrada à versão do agent.
- Mudanças passam por revisão de comitê clínico-técnico.
- Nenhum agent entra em `active` sem scorecard aprovado naquela versão.

---

## 8. Explainability

Cada decisão de agent carrega:

- **Inputs** considerados (com ponteiros para eventos).
- **Regras** aplicadas (quando rules-based).
- **Modelo + versão** usados.
- **Features** ou **tokens** relevantes.
- **Confiança** (0..1).
- **Referências** bibliográficas quando baseado em literatura.

Esse bloco é exibido ao usuário final quando ele consulta a origem da sugestão.

---

## 9. Auditoria de agents

- Cada decisão é um evento `agent.decision.made.v1`.
- Inputs e outputs são preservados (sanitizados quanto a PII quando exportados).
- Ligação por `causation` ao comando humano que aceitou/rejeitou.
- Dashboards de uso, aceitação, impacto.
- Relatórios para comitê clínico.

---

## 10. Melhoria contínua

### 10.1. Learning loop

1. **Coleta** — decisões do agent + feedback humano (aceitar/rejeitar/modificar).
2. **Rotulagem** — casos discordantes viram dados de treinamento.
3. **Avaliação** — novo modelo / nova regra é testado em sandbox.
4. **Promoção** — passa por `shadow` antes de voltar a `active`.
5. **Comunicação** — changelog visível para usuários.

### 10.2. Aprendizado com erros

- Incidentes envolvendo agents geram **post-mortem** público (dentro do hospital).
- Root cause mapeado: problema no modelo? nos dados? na cadeia de validação?
- Ação corretiva registrada no ADR do agent.
- Scorecard atualizado com nova métrica quando relevante.

---

## 11. Segurança

- Agent roda em serviço dedicado com mTLS e política de rede restrita.
- Input sanitization contra prompt injection.
- Output validation antes de expor ao usuário.
- Segregação de dados de treinamento e dados de inferência.
- LLM provider selecionado com DPA e residência de dados aprovada.
- Opção de LLM self-hosted para tenants com exigência regulatória.

---

## 12. Responsabilidade e accountability

- Todo agent tem **dono clínico** e **dono técnico** nomeados.
- Responsabilidade legal por decisão clínica permanece com o profissional humano.
- Agent nunca é apresentado como autoridade final.
- Termos de uso explicitam o papel do agent.

---

## 13. Governança formal

### 13.1. Comitê de Agents Clínicos

Composição:

- Diretor médico / clínico.
- Farmacêutico responsável.
- Coordenador de enfermagem.
- CTO / Eng. Líder.
- DPO.
- Representante de segurança do paciente.

Responsabilidades:

- Aprovar mudanças de fase.
- Revisar scorecards.
- Decidir sobre kill switches.
- Auditar incidentes.
- Publicar relatórios trimestrais.

### 13.2. ADR por agent

Cada agent tem seus próprios ADRs (Architecture Decision Records) versionados.

---

## 14. Exemplos de agents no roadmap

- `pharmacy-interaction-detector` — informativo.
- `triage-priority-assistant` — recomendatório.
- `note-summarizer` — assistente.
- `housekeeping-dispatcher` — autônomo em escopo restrito.
- `denial-root-cause-classifier` — recomendatório.
- `early-warning-signal-detector` — informativo.
- `reconciliation-assistant` — assistente.
- `code-suggester` (TUSS/SIGTAP) — assistente.

---

## 15. Observabilidade específica de agents

- `agent_decision_total{agent, phase, outcome}`
- `agent_latency_seconds{agent}`
- `agent_token_usage_total{agent, model}`
- `agent_agreement_rate{agent}`
- `agent_killswitch_active{agent}`
- Traces com spans dedicados: `agent.input`, `agent.reason`, `agent.validate`, `agent.output`.

---

## 16. Referências

- `docs/architecture/velya-hospital-platform-overview.md`
- `docs/observability/platform-observability-model.md`
- `docs/security/access-audit-signature-model.md`
- NIST AI Risk Management Framework.
- WHO — Ethics and governance of artificial intelligence for health.
- FDA — Good Machine Learning Practice for Medical Device Development.
