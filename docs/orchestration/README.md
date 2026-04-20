# Centro de Orquestração de Agentes

Sistema de orquestração multi-agente da empresa. Cobre os produtos atuais (**Velya Hospitalar** e **Lince SOC**) e está preparado para novos produtos conforme aparecerem.

Este documento é **autocontido** — um novo agente (humano ou IA, incluindo Codex) deve conseguir ler esta página e continuar a trabalhar sem precisar reconstruir o contexto.

---

## 1. Visão geral

A "empresa virtual" é composta por:

- **108 agentes especialistas** organizados em **25 alas** (escritórios).
- **Separação por produto**: Velya Hospitalar (azul), Lince SOC (vermelho), Compartilhado (cinza).
- **Dashboard React + Phaser 2D** em `dashboard/` mostra todos os agentes em tempo real.
- **Ledger append-only** em `.claude/ledger/delegations.jsonl` registra toda delegação.
- **Auto-discovery** — basta criar um arquivo `.md` em `.claude/agents/` para o agente aparecer no dashboard com persona pt-BR gerada automaticamente.
- **Opensquad squads** em `squads/` para pipelines multi-agente (ex: release-notes).

---

## 2. Estrutura de arquivos

```
velya-platform/
├── .claude/
│   ├── agents/                         # 104 arquivos .md — cada agente especialista
│   │   ├── legal-counsel-agent.md
│   │   ├── grafana-specialist-agent.md
│   │   ├── hospital-scheduling-agent.md
│   │   └── ... (uma agent por arquivo)
│   ├── ledger/
│   │   ├── delegations.jsonl           # append-only, uma delegação por linha
│   │   └── README.md                   # protocolo
│   ├── rules/                          # regras do projeto (governança, segurança)
│   └── skills/                         # skills automatizáveis
├── squads/
│   └── release-notes/                  # squad Opensquad
│       ├── squad.yaml
│       ├── squad-party.csv
│       ├── agents/                     # agents do squad (formato Opensquad .agent.md)
│       ├── pipeline/steps/             # passos do pipeline
│       ├── _memory/                    # memórias e runs
│       ├── state.json                  # estado em tempo real durante execução
│       └── output/<run-id>/            # artefatos por execução
├── dashboard/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx                     # tabs + painéis globais
│       ├── types/
│       │   ├── company.ts              # Office, EngineeringAgent, Product
│       │   └── state.ts                # SquadState, WsMessage, DelegationEntry
│       ├── plugin/
│       │   ├── squadWatcher.ts         # Vite plugin — WebSocket + chokidar
│       │   ├── companyLoader.ts        # lê .claude/agents/ e monta o mapa
│       │   ├── autoPersona.ts          # gera persona pt-BR para agents novos
│       │   └── ledgerLoader.ts         # lê delegations.jsonl
│       ├── lib/
│       │   ├── agentPersona.ts         # personas manuais (nome, cargo, gender)
│       │   ├── avatarFor.ts            # map id → sprite pixel-art
│       │   ├── deriveAgentStatus.ts    # status dos agents de engenharia via ledger
│       │   └── buildActiveRooms.ts     # rooms do 2D a partir de state+ledger
│       ├── components/
│       │   ├── CompanyMap.tsx          # planta baixa (todos os 108 agents)
│       │   ├── OfficeSection.tsx       # uma sala
│       │   ├── AgentCharacter.tsx      # um personagem com status
│       │   ├── AgentDetailPanel.tsx    # slide-in à direita
│       │   ├── ActivityFeed.tsx        # rodapé direito — eventos ao vivo
│       │   ├── DelegationLedger.tsx    # rodapé esquerdo — ledger
│       │   ├── WorkingNowPanel.tsx     # topo — quem está trabalhando
│       │   └── ActiveAlaPanel.tsx      # embed do 2D na empresa inteira
│       ├── office/                     # cena Phaser 2D
│       │   ├── OfficeScene.ts          # multi-sala simultânea
│       │   ├── AgentSprite.ts          # personagem 2D com balão de tarefa
│       │   ├── RoomBuilder.ts
│       │   ├── PhaserGame.tsx          # bridge React→Phaser
│       │   └── assetKeys.ts
│       └── store/
│           └── useSquadStore.ts        # zustand — state central
└── docs/
    └── orchestration/
        └── README.md                   # este arquivo
```

---

## 3. Inventário atual — 108 agentes em 25 alas

### Executivo · CEO (1 agente)
- **João Lucas Lima Freire** · CEO · Fundador

### Conselho de Governança (6 agentes) · **SHARED**
Arbitra conflitos de política e aplica padrões da plataforma.
- Ricardo Almeida · Conselheiro-Chefe de Governança **[Conselheiro]**
- Fernanda Teixeira · Auditora de Meta-Governança **[Conselheiro]**
- Eduardo Moraes · Analista de Falhas de Governança
- Patrícia Brandão · Revisora de Governança de Agents
- Leonardo Carvalho · Guardião da Nomenclatura
- Renata Figueiredo · Coordenadora de Delegação **[Coordenador]**

### Time Adversarial e Descoberta de Pontos Cegos (6) · **SHARED**
- Marcelo Aragão · Gerente do Red Team **[Gerente]**
- Bianca Mendonça · Coordenadora de Blind Spots **[Coordenador]**
- Vinícius Prado · Analista Adversarial
- Letícia Barroso · Analista de Prompt Injection
- Otávio Rangel · Quebrador de Readiness
- Débora Siqueira · Engenheira de Caos

### Fábrica de Agentes e Execução (7) · **SHARED**
- Camila Botelho · Gerente de Saúde de Agents **[Gerente]**
- Bruno Machado · Supervisor de Runtime **[Supervisor]**
- Natália Ferraz · Analista de Falhas de Runtime
- Daniel Rocha · Triador de Falhas de CI
- Gabriela Azevedo · Auditora de Configurações do Repo
- Henrique Diniz · Guardião de Pins e Versões
- Miguel Cunha · Especialista em Desempenho e Regressão (auto)

### Plataforma e Infraestrutura (7) · **SHARED**
- Pedro Batista · Operador de EKS Sênior
- Isabela Nogueira · Operadora de ArgoCD
- Felipe Ramalho · Operador GitOps
- Carolina Peixoto · Especialista em Kubernetes
- Gustavo Tavares · Monitor de Saúde de Infra
- Beatriz Cordeiro · Planejadora de Infra
- Rodrigo Quintela · Scanner de Drift de Bootstrap

### Escritório de Segurança (interno, 2) · **SHARED**
- Larissa Montenegro · Revisora de Segurança
- Augusto Sampaio · Revisor de IAM

### Qualidade de Engenharia (7) · **SHARED**
- Matheus Gusmão · Analista de Qualidade Backend
- Amanda Cerqueira · Analista de Qualidade Frontend
- Caio Bezerra · Revisor de Quality Gate
- Vanessa Delgado · Arquiteta de Testes
- Diego Fontoura · Designer de API
- Luísa Meireles · Auditora de UI
- Alex Bragança · Redator de ADRs

### Escritório de Arquitetura (4) · **SHARED**
- Tatiana Villela · Arquiteta da Plataforma de IA
- Fábio Guimarães · Arquiteto de Serviços
- Helena Marinho · Revisora de Modelo de Domínio
- Marco Valverde · Revisor de Observabilidade

### Escritório Financeiro de Operações (2) · **SHARED**
- Regina Castilho · Revisora Financeira de Operações
- Márcio Parente · Caçador de Explosão de Custo

### Mercado e Conteúdo (2) · **SHARED**
- Priscila Rezende · Gerente de Inteligência de Mercado **[Gerente]**
- André Coutinho · Redator de Marketing

### Jurídico e Conformidade (3) · **SHARED**
- (auto personas) · Conselheiro Jurídico — `legal-counsel-agent`
- LGPD — `lgpd-compliance-agent`
- ANS — `ans-compliance-agent`

### Cliente e Crescimento (4) · **SHARED**
- Customer Success · `customer-success-agent`
- Onboarding · `customer-onboarding-agent`
- Product Analytics · `product-analytics-agent`
- Support SLA · `support-sla-tracker-agent`

### Observatório de Gaps e Bugs (1) · **SHARED**
- Proactive Bug Hunter · `proactive-bug-hunter-agent`
- (Note: `gap-analysis-agent` existe, roteamento pode ser ajustado)

### Experiência do Desenvolvedor (1) · **SHARED**
- Developer Documentation · `developer-documentation-agent`

### Alas Operacionais e Criativas (opensquad, 3) · **SHARED**
- Joana Paiva · Coletora de Commits
- Paulo Aguiar · Redator Sênior de Notas de Versão
- Clara Resende · Revisora Técnica

### Especialistas em Ferramentas (20) · **SHARED**
Consultores internos, um por ferramenta da stack:

| Agent | Persona | Cargo |
|---|---|---|
| `grafana-specialist-agent` | Tiago Maldonado | Especialista em Observabilidade Grafana |
| `prometheus-specialist-agent` | Sabrina Holanda | Especialista em Métricas Prometheus |
| `opentelemetry-specialist-agent` | Nelson Queiroz | Especialista em OpenTelemetry |
| `loki-specialist-agent` | Mirela Escobar | Especialista em Loki (logs) |
| `tempo-specialist-agent` | Rogério Sales | Especialista em Tempo (traces) |
| `kyverno-specialist-agent` | Adriana Benício | Especialista em Kyverno (policy-as-code) |
| `helm-specialist-agent` | Vitor Amorim | Especialista em Helm |
| `argocd-specialist-agent` | Cláudia Trindade | Especialista em ArgoCD (GitOps avançado) |
| `aws-specialist-agent` | Reinaldo Albuquerque | Especialista AWS |
| `opentofu-specialist-agent` | Milena Drummond | Especialista em OpenTofu |
| `terragrunt-specialist-agent` | Wagner Linhares | Especialista em Terragrunt |
| `external-secrets-specialist-agent` | Patrícia Santarém | Especialista em External Secrets |
| `nats-specialist-agent` | Iago Schmitt | Especialista em NATS JetStream |
| `temporal-specialist-agent` | Bárbara Galvão | Especialista em Temporal |
| `postgresql-specialist-agent` | Everton Bastos | Especialista em PostgreSQL |
| `medplum-fhir-specialist-agent` | Cecília Cavalcante | Especialista em Medplum e FHIR R4 |
| `docker-specialist-agent` | Hélio Zambon | Especialista em Docker e Imagens OCI |
| `github-actions-specialist-agent` | Melissa Chavantes | Especialista em GitHub Actions |
| `typescript-specialist-agent` | Anderson Espósito | Especialista em TypeScript |
| `zod-specialist-agent` | Rosângela Lacerda | Especialista em Zod (validação runtime) |

### Aprendizado Contínuo e Manutenção (5) · **SHARED**
Meta-agents que mantêm os outros atualizados:

| Agent | Persona | Cargo |
|---|---|---|
| `web-research-agent` | Dandara Freitas | Pesquisadora Web e Radar Tecnológico |
| `agent-trainer-agent` | Rômulo Seixas | Treinador de Agentes |
| `dependency-updater-agent` | Eliane Bittencourt | Atualizadora de Dependências |
| `knowledge-base-keeper-agent` | Jorge Vasquez | Curador da Base de Conhecimento |
| `continuous-improvement-coordinator-agent` | Yasmin Passos | Coordenadora de Melhoria Contínua **[Coordenador]** |

### Velya Hospitalar (exclusivo, 14 agentes) · 🔵 **HOSPITALAR**

**Segurança Clínica (4):** Mariana Soares (Triagem) · Rafael Lacerda (Gaps Clínicos) · Juliana Pimentel (HIPAA) · Thiago Vasconcelos (Vazamento Privacidade)

**Operações Hospitalares (5):** `hospital-scheduling-agent` · `hospital-discharge-summary-agent` · `hospital-pharmacy-reconciliation-agent` · `hospital-telemedicine-agent` · `hospital-chart-review-agent`

**Ciclo de Receita (3):** `hospital-tuss-coding-agent` · `hospital-claim-denial-agent` · `hospital-insurance-preauth-agent`

**Inteligência Clínica (2):** `hospital-lab-results-agent` · `hospital-imaging-dicom-agent`

### Lince SOC (exclusivo, 13 agentes) · 🔴 **LINCE**

**Operações (3):** `soc-log-ingestion-agent` · `soc-alert-triage-agent` · `soc-detection-engineering-agent`

**Inteligência de Ameaças (4):** `soc-threat-hunting-agent` · `soc-ioc-management-agent` · `soc-cti-aggregator-agent` + adversarial-behavior (compartilhado com Red Team)

**Resposta a Incidentes (4):** `soc-soar-orchestration-agent` · `soc-forensics-agent` · `soc-phishing-analysis-agent` · `soc-malware-analysis-agent`

**Gestão de Vulnerabilidades (2):** `soc-vulnerability-management-agent` · `soc-pentest-automation-agent`

---

## 4. Protocolo de Delegação (OBRIGATÓRIO)

Toda delegação entre agents é registrada em `.claude/ledger/delegations.jsonl` (append-only, JSON Lines).

### Formato de entrada

```jsonl
{"id":"2026-04-14T13:00:00Z-1","ts":"2026-04-14T13:00:00Z","from":"ceo","to":"legal-counsel-agent","task":"Revisar feature X","context":"Detalhes...","status":"pending","evidencePath":null}
```

### Campos

| Campo | Obrigatório | Valores |
|---|---|---|
| `id` | sim | único, sugerido `<ISO>-<n>` |
| `ts` | sim | ISO 8601 |
| `from` | sim | id do delegante (agent id ou `ceo`/`user`) |
| `to` | sim | id do delegatário |
| `task` | sim | descrição curta em pt-BR |
| `context` | sim | o que o delegatário precisa saber para executar |
| `status` | sim | `pending` → `in-progress` → `completed` / `blocked` / `rejected` |
| `evidencePath` | não | caminho do artefato final (PR, doc, dashboard) |
| `blockReason` | quando `status=blocked` | motivo |

### Ciclo de vida

1. **Criação** — linha com `status: "pending"` ao solicitar.
2. **Em execução** — nova linha, mesmo `id`, `status: "in-progress"`.
3. **Conclusão** — nova linha, mesmo `id`, `status: "completed"` + `evidencePath`.

**Nunca editar linhas antigas.** O dashboard agrega por `id` e usa o status mais recente.

### Quem escreve

- Claude Code (main session) quando delega via `Task` tool.
- Qualquer subagent invocado.
- Humanos (raro, mas permitido).
- CI que dispara trabalho para um agent.

### Supervisão

O `delegation-coordinator-agent` (Renata Figueiredo) supervisiona integridade — detecta:
- Delegações `pending` há > 24h sem ação.
- Loops (A → B → A).
- Órfãs (sem status final após prazo).
- Contextos cruzados entre produtos (um agente compartilhado tratando contextos de Velya e Lince no mesmo `id` sem separação).

---

## 5. Auto-discovery de novos agentes

### Criar um agente novo

1. Crie `.claude/agents/<id>.md` com frontmatter mínimo:

```markdown
---
name: <agent-id>
description: <descrição em inglês — opcional, usada como fallback>
---

<corpo com escopo, regras, colaborações>
```

2. O **watcher chokidar** no Vite dev server detecta o arquivo.
3. `companyLoader.ts` parseia frontmatter, decide a ala pelo `inferOffice(id)` (regex de roteamento) e cria `EngineeringAgent`.
4. `autoPersona.ts` gera:
   - Nome próprio determinístico (hash do id contra pool pt-BR).
   - Gênero inferido do nome.
   - Cargo traduzido do `name` via glossário + prefixo "Especialista em".
   - Descrição pt-BR a partir da descrição em inglês.
5. WebSocket `SNAPSHOT` re-emite, React re-renderiza — agente novo aparece em < 1s.

### Refinar persona manualmente

Edite `dashboard/src/lib/agentPersona.ts` adicionando entrada em `PERSONA_MAP`:

```typescript
"<agent-id>": {
  firstName: "...",
  lastName: "...",
  role: "Cargo pt-BR",
  gender: "m" | "f",
  leadership: "ceo" | "conselheiro" | "gerente" | "coordenador" | "supervisor" | null,
  descriptionPtBr: "descrição em pt-BR"
}
```

Mapping manual tem prioridade sobre auto-persona.

---

## 6. Dashboard — como rodar

```bash
cd velya-platform/dashboard
npm install
npm run dev
# abre http://localhost:5173/
```

### Abas

- **Todos os agentes** — planta baixa com os 108 agentes, filtro por produto, busca, detail panel (clique em qualquer personagem).
- **Escritório 2D da ala** — cena Phaser com multi-sala simultânea, rótulos, balões de tarefa.

### Painéis persistentes

- **Trabalhando Agora** (topo) — lista de todos que estão `working`/`checkpoint` com tarefa atual.
- **Ala em operação ao vivo** (logo abaixo) — embed Phaser 2D da(s) ala(s) com atividade.
- **Activity Feed** (rodapé direito) — eventos em tempo real.
- **Ledger de Delegações** (rodapé esquerdo) — pendentes/em curso/todas.
- **Agent Detail** (slide-in direito ao clicar) — bio, escritório, histórico, tarefa atual.

### Filtro por produto

- **Todos os produtos** (default)
- **Velya Hospitalar** 🔵 — mostra alas exclusivas + compartilhadas
- **Lince SOC** 🔴 — mostra alas exclusivas + compartilhadas
- **Compartilhado** ⚫ — apenas as 15 alas que atendem aos dois produtos

### Cores

- 🔵 Azul `#0ea5e9` — Velya Hospitalar
- 🔴 Vermelho `#ef4444` — Lince SOC
- ⚫ Cinza `#64748b` — Compartilhado

---

## 7. Opensquad — quando usar

Opensquad é um framework MIT externo (`@dicebear`/`opensquad` npm package) para **pipelines multi-agente** com orquestração formal (state.json, checkpoints humanos, runs com run_id).

### Squad existente: `release-notes`

Gera changelog + anúncio stakeholder a partir de commits `chore(release): v*`.

Rodar:
```
/opensquad run release-notes
```

Fluxo:
1. Coletor de Commits (Joana) → brief.
2. Redator (Paulo) → changelog + anúncio.
3. Revisora Técnica (Clara) → relatório de revisão.
4. Checkpoint humano → aprovação + persistência.

### Criar squad novo

```
/opensquad create
```

O Architect conduz Discovery (8 perguntas) → Investigation (Sherlock opcional) → Design → Build. Arquivos gerados em `squads/<code>/`.

---

## 8. Ferramentas da stack cobertas

Todas as ferramentas principais têm um especialista dedicado em `.claude/agents/`:

| Área | Ferramenta | Especialista |
|---|---|---|
| Observabilidade | Grafana | `grafana-specialist-agent` |
| | Prometheus | `prometheus-specialist-agent` |
| | OpenTelemetry | `opentelemetry-specialist-agent` |
| | Loki | `loki-specialist-agent` |
| | Tempo | `tempo-specialist-agent` |
| Política/GitOps | Kyverno | `kyverno-specialist-agent` |
| | ArgoCD | `argocd-specialist-agent` + `argocd-healer-agent` + `gitops-operator` |
| | Helm | `helm-specialist-agent` |
| Cloud | AWS | `aws-specialist-agent` |
| | External Secrets | `external-secrets-specialist-agent` |
| IaC | OpenTofu | `opentofu-specialist-agent` |
| | Terragrunt | `terragrunt-specialist-agent` |
| Runtime | Kubernetes/EKS | `eks-operator` + `k8s-troubleshooter-agent` |
| | NATS JetStream | `nats-specialist-agent` |
| | Temporal | `temporal-specialist-agent` |
| Dados | PostgreSQL | `postgresql-specialist-agent` |
| | Medplum FHIR | `medplum-fhir-specialist-agent` |
| Container | Docker/OCI | `docker-specialist-agent` |
| CI | GitHub Actions | `github-actions-specialist-agent` |
| Código | TypeScript | `typescript-specialist-agent` |
| | Zod | `zod-specialist-agent` |

---

## 9. Skills do Claude Code usadas nesta sessão

As seguintes skills foram invocadas ou estão disponíveis para o agente que continuar:

- `opensquad` — framework de orquestração multi-agent (já instalado em `squads/`).
- `schedule` — cron jobs de agent (não usado ainda, mas disponível).
- `using-git-worktrees` — worktrees isoladas quando começar feature.
- `writing-plans` — planejamento de multi-step tasks.
- `systematic-debugging` — ciclo de debug rigoroso.
- `verification-before-completion` — rodar verificação antes de reportar "pronto".
- `adversarial-review` — crítica antes de escrever código.
- `brainstorming` — explorar requisitos antes de implementar.
- `test-driven-development` — TDD ciclo.
- `subagent-driven-development` — execução paralela via Task tool.
- `webapp-testing` — playwright para testar UI.
- `frontend-design` — padrões para UI.
- `vercel-react-best-practices` — performance React/Next.

---

## 10. Como Codex (ou qualquer agente de continuação) deve usar isto

1. **Ler este arquivo primeiro.** Ele tem contexto suficiente para não precisar reconstruir.
2. **Verificar o ledger atual:** `cat .claude/ledger/delegations.jsonl | tail -20`.
3. **Checar dashboard vivo:** `curl http://localhost:5173/api/snapshot | jq .`.
4. **Antes de criar agente novo:** confira `inferOffice()` em `dashboard/src/plugin/companyLoader.ts` e ajuste heurísticas se o novo id não bater com nenhum padrão.
5. **Ao delegar trabalho:** sempre registre no ledger (`pending` → `in-progress` → `completed` + `evidencePath`).
6. **Ao tocar um agente existente:** não edite `.claude/agents/<id>.md` diretamente. Crie PR, passe pelo `agent-governance-reviewer` e registre no ledger via `agent-trainer-agent`.
7. **Ao adicionar ferramenta nova na stack:** crie `.claude/agents/<tool>-specialist-agent.md` + adicione entrada manual em `PERSONA_MAP` de `agentPersona.ts`.
8. **Problema crítico de segurança/regulação:** delegue para `legal-counsel-agent` + `security-reviewer` + `red-team-manager-agent` simultaneamente.

---

## 11. Backlog conhecido (o que pode ser feito depois)

- [ ] Tema visual por produto na cena 2D (decoração clínica pra hospital, terminais escuros pra SOC).
- [ ] Animação de handoff (seta entre desks quando delegação muda de `to`).
- [ ] Scheduler externo (cron) para execução autônoma do squad release-notes.
- [ ] Métricas Prometheus do próprio orquestrador (quantidade de delegações, tempo médio, taxa de conclusão).
- [ ] Deploy em Kubernetes se houver necessidade de acesso multi-device (hoje é local).
- [ ] Auditoria manual dos ~30 agentes com cargo auto-gerado que ainda estão meio estranhos em pt-BR (ex: `performance-regression-scanner-agent` saiu como "Especialista em Desempenho Regressão" — ok, mas poderia ser refinado).
- [ ] Melhoria: roteamento por officeId quando o agent tem sufixo `*-specialist` já está no escritório errado (ex: `performance-regression-scanner-agent` foi pra `agent-factory`, poderia ir pra `tool-specialists`).
- [ ] Integração com autopilot hub (`/workspace/hub/autopilot/state/workspaces/ws-default/agent-sync-status.json`) quando disponível — hoje os 104 agents de engenharia só acendem via delegações.

---

## 12. Contato operacional

- **CEO** — João Lucas Lima Freire (`executive/ceo`) — autoriza risco alto e checkpoints críticos.
- **Conselho de Governança** — arbitra políticas (`governance-council` e 5 conselheiros).
- **Coordenadora de Delegação** — Renata Figueiredo (`delegation-coordinator-agent`) — owner do ledger.
- **Coordenadora de Melhoria Contínua** — Yasmin Passos (`continuous-improvement-coordinator-agent`) — owner da evolução dos próprios agentes.

Quando em dúvida sobre onde encaminhar uma tarefa, o fluxo padrão é: **usuário/CEO → `delegation-coordinator-agent` → agente correto**.

---

**Última atualização:** 2026-04-14 · construído via sessão interativa Claude Code.
