# Perfil da Empresa

## Nome
Velya Platform

## Descrição
Plataforma AI-native de produtos verticais em saúde hospitalar e segurança digital, rodando em AWS EKS. Stack TypeScript/Node.js, dados clínicos FHIR-first via Medplum, arquitetura event-driven (NATS JetStream + Temporal). O monorepo `velya-platform` é a fonte única da verdade.

## Produtos

### Velya Hospitalar
Plataforma hospitalar AI-native — gestão clínica, fluxos assistenciais e operação hospitalar. FHIR-first. Público: operadoras, hospitais e equipes clínicas.

### Lince SOC
Centro de Operações de Segurança — monitoramento, detecção e resposta a incidentes. Público: times de segurança e operações.

## Arquitetura de agents (MUITO IMPORTANTE)

A Velya já tem uma estrutura de agents enterprise documentada em `.claude/rules/` e `.claude/agents/` (46 agents ativos) organizada em **offices** com lifecycle formal. Os squads do opensquad **complementam** essa estrutura — não substituem, não replicam, não competem.

### O que já existe (não mexer)
- **Offices** com Manager, Validator, Auditor e Watchdog (ex: Agent Factory Office, Red Team & Blind Spot Discovery Office, Clinical Safety, Governance Council).
- **Lifecycle obrigatório:** `draft → sandbox → shadow → probation → active → deprecated → retired`. Nenhum agent entra em `active` sem shadow mode (2 semanas não-clínico, 4 semanas clínico/financeiro).
- **Padrão de nomenclatura:** `{office}-{role}-agent` (ex: `clinical-triage-agent`, `red-team-manager-agent`).
- **AI Gateway obrigatório:** nenhum serviço chama LLM diretamente. Tudo passa por `packages/ai-gateway/`.
- **Scorecards semanais** com thresholds de validation pass rate, audit pass rate, evidence completeness, SLA, correction recurrence.

### Onde o opensquad se encaixa
O opensquad é ferramenta de orquestração **leve** para squads operacionais/criativos que **não tocam dados clínicos, financeiros ou infraestrutura de produção**. Casos apropriados:

- Conteúdo e marketing (posts, carrosséis, newsletter, vídeos institucionais)
- Release notes e changelogs a partir de commits do monorepo
- Documentação de skills, runbooks, tutoriais internos
- Pesquisa competitiva e market intelligence não-sensível
- Relatórios consolidados a partir de fontes públicas

Casos **proibidos** para squads do opensquad (usar os offices existentes):
- Qualquer coisa que toque FHIR, PHI, prontuários, prescrições, ordens clínicas
- Mudanças em infraestrutura de produção, IAM, secrets, migrations
- Decisões de billing ou transações financeiras
- Ações que modifiquem permissões de outros agents
- Comunicação externa em nome da empresa sem checkpoint humano

## Marca e Tom de Voz

- **Tom:** profissional, direto, técnico quando necessário, acessível para stakeholders não-técnicos.
- **Idioma padrão:** Português (Brasil).
- **Evitar:** jargão marketeiro, superlativos genéricos ("incrível", "revolucionário"), emojis em textos corporativos, emojis em código.
- **Preferência confirmada:** respostas terse, sem resumos redundantes no fim.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime | TypeScript / Node.js |
| IaC | OpenTofu (nunca Terraform) |
| GitOps | ArgoCD |
| Messaging | NATS JetStream |
| Workflows | Temporal |
| Database | PostgreSQL |
| FHIR | Medplum |
| Orquestração | AWS EKS Auto Mode |
| Observabilidade | OpenTelemetry |
| Secrets | External Secrets Operator + AWS Secrets Manager |
| CI | GitHub Actions (pinnadas por SHA) |

## Regras não-negociáveis que todo squad deve respeitar

1. **Zero secrets em código.** Nenhum prompt de squad pode gerar arquivo com secret inline.
2. **Nenhum `latest` tag.** Imagens, charts, dependências sempre pinnadas.
3. **Git é fonte da verdade.** Toda mudança em repo tem PR.
4. **Checkpoint humano obrigatório** antes de publicar qualquer conteúdo externo (LinkedIn, email, redes sociais, blog público).
5. **PHI nunca sai do contexto clínico.** Squads não-clínicos não recebem, processam ou referenciam dados de pacientes.
6. **Output em Português (Brasil)** por padrão, a menos que o squad tenha audiência internacional explícita.

## Coordenação com o hub

Trabalho operacional parte de `/workspace/hub/autopilot`; implementação fica em `/workspace/hub/project`. O `agent-sync-status.json` em `autopilot/state/workspaces/ws-default/` é o snapshot coordenação dos agents de engenharia — opensquad é ortogonal a isso.

## Responsável

Lucas Freire — founder, dá autonomia operacional plena aos agents (ref: `~/.claude/projects/-home-jfreire/memory/feedback_full_autonomy.md`). Recomendações são compromissos, não opções: quando um agent lista "próximos passos", esses passos já são a próxima ação.
