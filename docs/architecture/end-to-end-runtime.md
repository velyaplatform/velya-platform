# Velya — Documentação de Runtime End-to-End

> Última atualização: 2026-04-11 · Commit: `c3a438b` (v1.39.0)
> Mantenedor: Plataforma Velya · [velyaplatform@gmail.com](mailto:velyaplatform@gmail.com)
> Escopo: descreve **tudo** o que roda em produção e no cluster local de desenvolvimento (`kind-velya-local`).

---

## Sumário executivo

A **Velya** é uma plataforma hospitalar brasileira com IA nativa, construída sobre três pilares:

1. **Frontend clínico** (`velya-web`) — Next.js 15 + React 19 com 60+ páginas cobrindo fluxo de pacientes, altas, delegações, prescrições, laboratório, imagem, farmácia, suprimentos, governança, auditoria e observabilidade.
2. **Backend em microserviços** — 4 serviços NestJS (`patient-flow`, `discharge-orchestrator`, `task-inbox`, `audit-service`) mais 3 serviços de plataforma (`ai-gateway`, `policy-engine`, `memory-service`, `decision-log-service`), comunicando por NATS JetStream.
3. **Camada autopilot autônoma** — hierarquia de 4 camadas de agentes (Workers → Managers → Governors → Council) que rodam como CronJobs no cluster, auditando frontend, backend e infra continuamente, abrindo PRs, aplicando remediações seguras e gravando evidências num PVC compartilhado.

Tudo é GitOps via ArgoCD, rodando num cluster `kind` de 5 nós (1 control-plane + 4 workers) para desenvolvimento local, e projetado para dois clusters EKS separados (App + AI/Agents) em produção.

### Stack resumida

| Camada              | Tecnologia                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| Frontend            | Next.js 15.1, React 19, Tailwind CSS v4, Radix UI, Geist/Inter, TanStack   |
| Backend             | NestJS 11, TypeScript 5.7, Node.js 20+                                     |
| Mensageria          | NATS 2.x com JetStream (1 StatefulSet, PVC 10 Gi)                          |
| Dados               | PostgreSQL 16 (StatefulSet, PVC 2 Gi local), arquivos em `/tmp/velya-*`    |
| Clínico             | FHIR R4 via Medplum (prod)                                                 |
| Workflows           | Temporal (prod) — ainda não instanciado no kind local                      |
| Observabilidade     | Prometheus, Grafana, Loki, Tempo, OpenTelemetry Collector                  |
| Secrets             | External Secrets Operator + AWS Secrets Manager (LocalStack no kind)       |
| GitOps              | ArgoCD (App-of-Apps)                                                       |
| Ingress             | ingress-nginx + cert-manager (Let's Encrypt prod)                          |
| Edge                | Cloudflare Tunnel → `velyahospitalar.com`                                  |
| Autoscaling         | KEDA ScaledObjects (CPU, memory, HTTP RPS, Prometheus)                     |
| CI/CD               | GitHub Actions (12 workflows)                                              |
| Agents runtime      | Claude Code subagents orquestrados via CronJobs in-cluster                 |

### URLs públicas de produção

| URL                                       | Propósito                                |
| ----------------------------------------- | ---------------------------------------- |
| `https://velyahospitalar.com`             | App principal (velya-web)                |
| `https://app.velyahospitalar.com`         | Alias explícito do app                   |
| `https://api.velyahospitalar.com`         | Endpoints de API                         |
| `https://grafana.velyahospitalar.com`     | Dashboards Grafana                       |
| `https://argocd.velyahospitalar.com`      | UI ArgoCD                                |

### Como rodar localmente em 3 comandos

```bash
# 1. Cluster + componentes base (kind + metallb + ingress + argocd)
./scripts/kind-setup.sh

# 2. Deploy do monorepo (builds + kubectl apply + argocd sync)
./scripts/deploy.sh

# 3. Validação end-to-end (espera pods Ready, testa ingressos, smoke auth)
./scripts/validate-platform.sh
```

Depois disso o app fica em `http://velya.172.19.0.6.nip.io` (ou `https://velya.local` se o `/etc/hosts` estiver configurado).

---

## 1. Topologia de alto nível

```text
                                  ┌────────────────────┐
                                  │  Browser (clínico) │
                                  └──────────┬─────────┘
                                             │ HTTPS
                                             ▼
                                  ┌────────────────────┐
                                  │ Cloudflare Tunnel  │  (produção)
                                  └──────────┬─────────┘
                                             │
                                             ▼
┌────────────────────────── Kubernetes cluster (kind ou EKS) ────────────────────────────┐
│                                            │                                           │
│                                ┌───────────┴───────────┐                                │
│                                │    ingress-nginx      │  (LB 172.19.0.100)             │
│                                │  + cert-manager TLS   │                                │
│                                └───────────┬───────────┘                                │
│                                            │                                           │
│                         ┌──────────────────┼───────────────────┐                        │
│                         ▼                  ▼                   ▼                        │
│               ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐                 │
│               │   velya-web     │ │ agent-orch.   │ │  grafana /      │                 │
│               │  (Next.js 15)   │ │ (NATS bridge) │ │  prometheus     │                 │
│               └────────┬────────┘ └───────┬───────┘ └─────────────────┘                 │
│                        │                  │                                             │
│            ┌───────────┼──────────────────┼───────────┐                                  │
│            │           │                  │           │                                  │
│   ┌────────▼───┐ ┌─────▼──────┐ ┌─────────▼────┐ ┌───▼─────────┐   velya-dev-core        │
│   │patient-flow│ │ discharge- │ │  task-inbox  │ │ audit-      │   (NestJS microsvcs)    │
│   │  :3001     │ │ orchestr.  │ │   :3003      │ │ service     │                         │
│   └─────┬──────┘ │   :3002    │ └──────┬───────┘ │   :3004     │                         │
│         │        └─────┬──────┘        │         └──────┬──────┘                         │
│         └──────────────┼───────────────┼────────────────┘                                │
│                        │  NATS JetStream (velya.*.v1 subjects)                           │
│                        ▼                                                                 │
│              ┌──────────────────┐   ┌────────────────┐   ┌──────────────┐                │
│              │     NATS         │   │  PostgreSQL    │   │  External    │                │
│              │ StatefulSet 1/1  │   │ StatefulSet    │   │  Secrets +   │                │
│              │   PVC 10 Gi      │   │ PVC 2 Gi       │   │  LocalStack  │                │
│              └──────────────────┘   └────────────────┘   └──────────────┘                │
│                                                                                           │
│  ┌──────────────────────────── Platform services ─────────────────────────────┐          │
│  │  ai-gateway :3010 · policy-engine :3030 · memory-service :3040            │          │
│  │  decision-log-service :3050 · agent-orchestrator :3020                    │          │
│  └───────────────────────────────────────────────────────────────────────────┘          │
│                                                                                           │
│  ┌───────────── Autopilot CronJobs (velya-dev-platform) ──────────────────────┐          │
│  │  L1: frontend-quality · backend-quality · infra-health · ui-audit          │          │
│  │  L2: agent-health-manager · agent-runtime-supervisor                       │          │
│  │  L3: meta-governance-auditor                                               │          │
│  │  Evidence PVC: velya-autopilot-data (2 Gi, RWO)                            │          │
│  └────────────────────────────────────────────────────────────────────────────┘          │
│                                                                                           │
│  ┌───────────── Observability (velya-dev-observability) ──────────────────────┐          │
│  │  prometheus-operator · grafana · tempo · loki · otel-collector             │          │
│  │  node-exporter (DS) · promtail (DS) · loki-canary (DS)                     │          │
│  └────────────────────────────────────────────────────────────────────────────┘          │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

As camadas conceituais são:

- **Edge** — Cloudflare Tunnel / cert-manager / ingress-nginx
- **App** — velya-web, agent-orchestrator
- **Platform** — ai-gateway, policy-engine, memory-service, decision-log-service, external-secrets
- **Core/Clinical** — patient-flow, discharge-orchestrator, task-inbox, audit-service
- **Data** — NATS JetStream, PostgreSQL, PVCs locais, Medplum (prod)
- **Observability** — Prometheus, Grafana, Loki, Tempo, OTel Collector
- **Autopilot** — fleet hierárquico de 4 camadas de agentes autônomos

---

## 2. Frontend — `velya-web` (Next.js 15)

### 2.1 Estrutura de código

```text
apps/web/
├── next.config.ts          → output: standalone, tracing root no repo root
├── middleware.ts           → re-exporta ../src/middleware.ts
├── package.json            → @velya/web · next 15.1 · react 19
└── src/
    ├── middleware.ts       → CSP + rate-limit + auth + audit structured
    ├── lib/                → stores, auth-session, access-control, cron, agents
    └── app/                → App Router
        ├── layout.tsx      → GeistSans + ErrorBoundary + Toast + Telemetry
        ├── globals.css     → design tokens Velya v3 (puro branco)
        ├── page.tsx        → home clínica
        ├── api/…/route.ts  → 40+ endpoints internos
        ├── components/
        │   ├── ui/         → 13 primitives (shadcn-style)
        │   └── velya/      → 12 domain components clínicos
        └── <feature>/      → 60+ páginas feature-first
```

Referências diretas:

- [`apps/web/src/app/layout.tsx`](../../apps/web/src/app/layout.tsx)
- [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css)
- [`apps/web/src/middleware.ts`](../../apps/web/src/middleware.ts)
- [`apps/web/next.config.ts`](../../apps/web/next.config.ts)

### 2.2 Rotas do App Router

Todas as 65 páginas (descobertas via `find apps/web/src/app -name page.tsx`):

| Path                                   | Tipo       | Quem acessa              | Fonte de dados             |
| -------------------------------------- | ---------- | ------------------------ | -------------------------- |
| `/`                                    | dashboard  | todos autenticados       | entity-store + events      |
| `/login`                               | pública    | anônimo                  | user-store                 |
| `/register`                            | pública    | anônimo                  | user-store                 |
| `/verify`                              | pública    | anônimo                  | user-store                 |
| `/me`                                  | profile    | autenticado              | auth-session               |
| `/agents`                              | list       | gestão/admin             | agent-state                |
| `/alerts`                              | list       | médico/enfermagem        | clinical-alerts-store      |
| `/activity`                            | timeline   | autenticado              | event-store                |
| `/assets`                              | list       | gestão                   | entity-store               |
| `/audit`                               | list       | compliance/admin         | audit-logger               |
| `/beds`                                | dashboard  | enfermagem/gestão        | entity-store (beds)        |
| `/billing/charges`                     | list       | billing                  | entity-store               |
| `/billing/claims`                      | list       | billing                  | entity-store               |
| `/billing/denials`                     | list       | billing                  | entity-store               |
| `/cleaning/tasks`                      | list       | higiene                  | entity-store               |
| `/compare/[moduleId]`                  | diff       | autenticado              | entity-store               |
| `/cron`                                | admin      | admin/IT                 | cron-jobs store            |
| `/delegations`                         | list       | médico                   | delegation-store           |
| `/delegations/new`                     | form       | médico                   | delegation-store           |
| `/delegations/[id]`                    | detalhe    | médico                   | delegation-store           |
| `/discharge`                           | workflow   | médico/case manager      | entity-store + NATS        |
| `/edit/[moduleId]/[recordId]`          | form       | autenticado              | entity-store               |
| `/employees`                           | list       | RH/admin                 | user-store                 |
| `/employees/new`                       | form       | admin                    | user-store                 |
| `/employees/[id]`                      | detalhe    | admin/RH                 | user-store                 |
| `/employees/[id]/edit`                 | form       | admin                    | user-store                 |
| `/ems`                                 | dashboard  | pronto-socorro           | entity-store               |
| `/facility/work-orders`                | list       | manutenção               | entity-store               |
| `/governance/audit-events`             | list       | compliance               | audit-logger               |
| `/governance/consent-forms`            | list       | compliance               | entity-store               |
| `/governance/credentials`              | list       | compliance               | entity-store               |
| `/handoffs`                            | list       | médico/enfermagem        | handoff-store              |
| `/handoffs/new`                        | form       | médico/enfermagem        | handoff-store              |
| `/handoffs/[id]`                       | detalhe    | médico/enfermagem        | handoff-store              |
| `/icu`                                 | dashboard  | UTI                      | entity-store               |
| `/imaging/orders`                      | list       | médico/imagem            | entity-store               |
| `/imaging/results`                     | list       | médico/imagem            | entity-store               |
| `/inbox`                               | inbox      | autenticado              | event-store                |
| `/lab/orders`                          | list       | médico/lab               | entity-store               |
| `/lab/results`                         | list       | médico/lab               | entity-store               |
| `/meals/orders`                        | list       | nutrição                 | entity-store               |
| `/patients`                            | list       | clínico                  | entity-store               |
| `/patients/new`                        | form       | recepção                 | entity-store + NATS        |
| `/patients/[id]`                       | detalhe    | clínico                  | entity-store               |
| `/patients/[id]/register-event`        | form       | clínico                  | event-store                |
| `/pharmacy`                            | dashboard  | farmácia                 | entity-store               |
| `/pharmacy/stock`                      | list       | farmácia                 | entity-store               |
| `/prescriptions`                       | list       | médico/farmácia          | entity-store               |
| `/quality/incidents`                   | list       | qualidade                | entity-store               |
| `/search`                              | search     | autenticado              | semantic-search            |
| `/specialties`                         | list       | gestão                   | entity-store               |
| `/specialties/[id]`                    | detalhe    | gestão                   | entity-store               |
| `/staff-on-duty`                       | dashboard  | gestão                   | oncall-store               |
| `/suggestions`                         | list       | produto                  | entity-store               |
| `/suppliers`                           | list       | compras                  | entity-store               |
| `/suppliers/new`                       | form       | compras                  | entity-store               |
| `/suppliers/[id]`                      | detalhe    | compras                  | entity-store               |
| `/suppliers/[id]/edit`                 | form       | compras                  | entity-store               |
| `/supply/items`                        | list       | suprimentos              | entity-store               |
| `/supply/purchase-orders`              | list       | suprimentos              | entity-store               |
| `/surgery`                             | dashboard  | cirurgia                 | entity-store               |
| `/system`                              | admin      | admin                    | system-health              |
| `/tasks`                               | list       | enfermagem               | entity-store               |
| `/tools/sepsis`                        | tool       | clínico                  | news2-calculator           |
| `/transport/orders`                    | list       | transporte               | entity-store               |
| `/wards`                               | list       | enfermagem/gestão        | entity-store               |
| `/waste/manifests`                     | list       | higiene/compliance       | entity-store               |

**Observação:** todas as rotas (exceto `/login`, `/register`, `/verify`) exigem cookie `velya_session` via middleware.

### 2.3 Design system

Tokens estão em [`globals.css`](../../apps/web/src/app/globals.css) no bloco `@theme` (Tailwind v4):

| Token                          | Valor              | Uso                                   |
| ------------------------------ | ------------------ | ------------------------------------- |
| `--color-bg-base`              | `#ffffff`          | fundo principal (puro branco)         |
| `--color-bg-elevated`          | `#fafafa`          | hover / elevação sutil                |
| `--color-border`               | `#e5e5e5`          | borders padrão                        |
| `--color-accent`               | `#2563eb`          | blue-600, ação primária única         |
| `--color-critical`             | `#b91c1c`          | red-700, status clínico crítico       |
| `--color-warning`              | `#b45309`          | amber-700                             |
| `--color-success`              | `#15803d`          | green-700                             |
| `--color-info`                 | `#1d4ed8`          | blue-700                              |
| `--text-primary`               | `#0a0a0a`          | preto quase puro                      |
| `--text-secondary`             | `#262626`          |                                       |
| `--font-sans`                  | `Inter, Geist…`    | tipografia base                       |
| `--sidebar-width`              | `260px`            | largura fixa do shell                 |
| `--topbar-height`              | `60px`             | header principal                      |
| `--radius-md`                  | `8px`              | cards + inputs                        |
| `--shadow-card`                | sutil 4%           | sem glow                              |

**Regra de ouro:** fundo branco puro, letras pretas, azul único sem neon/glow — padrão Epic Hyperspace / Athenahealth / Doximity.

#### Primitives `components/ui/`

| Arquivo               | Propósito                                   |
| --------------------- | ------------------------------------------- |
| `avatar.tsx`          | Avatar Radix (user + fallback)              |
| `badge.tsx`           | Badges de status (clinical severity)        |
| `button.tsx`          | Button com CVA variants                     |
| `card.tsx`            | Card container + header/content/footer      |
| `combobox.tsx`        | Combobox (cmdk + Radix Popover)             |
| `dialog.tsx`          | Modal dialog Radix                          |
| `dropdown-menu.tsx`   | Menus dropdown contextuais                  |
| `input.tsx`           | Input base (com slots de ícone)             |
| `separator.tsx`       | Separador horizontal/vertical               |
| `sheet.tsx`           | Sheet lateral (Radix Dialog side)           |
| `skeleton.tsx`        | Loading skeletons                           |
| `tabs.tsx`            | Tabs Radix                                  |
| `tooltip.tsx`         | Tooltip Radix (focus-visible aware)         |
| `index.ts`            | barrel export                               |

#### Domain components `components/velya/`

| Arquivo                       | Propósito                                                  |
| ----------------------------- | ---------------------------------------------------------- |
| `velya-alert-banner.tsx`      | Banner de alerta clínico (critical/warning/info)           |
| `velya-bed-tile.tsx`          | Tile de leito com status, paciente, pending tasks          |
| `velya-kpi.tsx`               | Card KPI (valor + delta + série histórica)                 |
| `velya-logo.tsx`              | Logo oficial Velya                                         |
| `velya-medical-cross.tsx`     | Cruz médica vetorial                                       |
| `velya-news2-gauge.tsx`       | Gauge NEWS2 (early-warning score)                          |
| `velya-page-header.tsx`       | Header padrão de página (título + breadcrumbs + actions)   |
| `velya-section.tsx`           | Seção semântica de conteúdo                                |
| `velya-shift-indicator.tsx`   | Indicador de plantão/shift atual                           |
| `velya-sparkline.tsx`         | Sparkline recharts minimalista                             |
| `velya-status-dot.tsx`        | Bolinha colorida (idle/warning/critical)                   |
| `velya-vital-sign.tsx`        | Display de sinal vital (valor + unidade + histórico)       |

### 2.4 Fluxo de autenticação

Fluxo completo (simplificado):

```text
1. POST /api/auth/login { email, password }
     │
     ▼
2. verify bcrypt hash (user-store)
     │
     ▼
3. createSession() em lib/auth-session.ts
     │  ├─ gera sessionId (32 bytes hex)
     │  ├─ escreve /tmp/velya-sessions/<sessionId>.json
     │  └─ retorna payload VelyaSession
     ▼
4. Set-Cookie: velya_session=<sessionId>; HttpOnly; Secure; SameSite=Lax
     │
     ▼
5. middleware.ts em cada request:
     │  ├─ checa cookie velya_session
     │  ├─ se ausente e rota é protegida → 302 /login
     │  ├─ se ausente e API → 401 { code: UNAUTHORIZED }
     │  ├─ rate-limit por IP (60 rps API · 10 rps /auth · 30 rps /ai)
     │  ├─ CSRF: checa Origin vs Host em POST/PUT/PATCH/DELETE
     │  ├─ CSP estrito + HSTS + X-Frame-Options DENY + Referrer-Policy
     │  └─ emite log estruturado para audit
     ▼
6. getSession() renova expiresAt (+30 min sliding window)
```

Pontos relevantes:

- Sessões são **file-based** em `/tmp/velya-sessions`, montado via PVC `velya-web-users-pvc` (1 Gi, RWO).
- Timeout **30 min** de inatividade (sliding window, renovado em cada acesso).
- Campos da sessão incluem `professionalRole`, `setor`, `workstationId`, `ipAddress`, `isBreakGlass`.
- RBAC implementado em [`lib/access-control.ts`](../../apps/web/src/lib/access-control.ts) com 30 `ProfessionalRole`s, 5 classes de dado (A–E), 19 `AccessAction`s e 8 níveis de acesso (0–7).
- Quatro seções de navegação: `ASSISTENCIAL`, `GESTAO`, `ADMINISTRACAO`, `OBSERVABILIDADE`.
- Break-glass é permitido para roles elegíveis e gera audit level `maximum`.

### 2.5 API routes internas

Todas as 40+ rotas descobertas em `apps/web/src/app/api/**/route.ts`:

| Rota                                             | Método(s)        | Propósito                                                |
| ------------------------------------------------ | ---------------- | -------------------------------------------------------- |
| `/api/health`                                    | GET              | healthcheck (pública, usada por kubelet + synthetic)     |
| `/api/auth/login`                                | POST             | login com bcrypt                                         |
| `/api/auth/logout`                               | POST             | destrói sessão                                           |
| `/api/auth/register`                             | POST             | registro self-service                                    |
| `/api/auth/session`                              | GET              | retorna VelyaSession atual                               |
| `/api/auth/verify`                               | POST             | verificação de e-mail/token                              |
| `/api/access`                                    | GET              | check de permissão (RBAC)                                |
| `/api/ack`                                       | POST             | acknowledge de alerta clínico                            |
| `/api/actions`                                   | GET/POST         | ações contextuais por entidade                           |
| `/api/agents`                                    | GET              | lista agents do fleet                                    |
| `/api/agents/[agentId]`                          | GET              | detalhe de um agent (status, últimas execuções)          |
| `/api/ai/agent`                                  | POST             | invoca agente AI (orquestrador)                          |
| `/api/ai/chat`                                   | POST             | chat AI (passa pelo ai-gateway)                          |
| `/api/ai/policy`                                 | POST             | consulta policy-engine                                   |
| `/api/ai/suggest`                                | POST             | sugestões contextuais                                    |
| `/api/alerts`                                    | GET              | alertas clínicos ativos                                  |
| `/api/audit`                                     | GET/POST         | audit log (com hash chain)                               |
| `/api/break-glass`                               | POST             | ativação de break-glass                                  |
| `/api/cron/findings`                             | GET              | findings gerados pelos cron runners                      |
| `/api/cron/jobs`                                 | GET              | jobs cron declarados                                     |
| `/api/cron/run/[jobId]`                          | POST             | dispara job manualmente                                  |
| `/api/cron/start`                                | POST             | start do cron scheduler                                  |
| `/api/delegations`                               | GET/POST         | CRUD de delegações                                       |
| `/api/delegations/[id]`                          | GET/PATCH        | detalhe / update                                         |
| `/api/entities/[moduleId]`                       | GET/POST         | entity-store genérico                                    |
| `/api/entities/[moduleId]/[recordId]`            | GET/PATCH/DELETE | entity-store genérico — por id                           |
| `/api/errors`                                    | POST             | client error reporter                                    |
| `/api/events`                                    | GET/POST         | event-store                                              |
| `/api/favorites`                                 | GET/POST/DELETE  | favoritos do usuário                                     |
| `/api/following`                                 | GET/POST/DELETE  | follow em entidades                                      |
| `/api/following/notifications`                   | GET              | notificações por entidades seguidas                      |
| `/api/handoffs`                                  | GET/POST         | handoff store                                            |
| `/api/handoffs/[id]`                             | GET/PATCH        | handoff por id                                           |
| `/api/learning/curator`                          | POST             | curadoria de aprendizado                                 |
| `/api/me/activity`                               | GET              | minha atividade recente                                  |
| `/api/metrics`                                   | GET              | métricas Prometheus-formatted (scrape interno)           |
| `/api/nav-telemetry`                             | POST             | telemetria de navegação UX                               |
| `/api/patients`                                  | GET/POST         | patient-store (proxy para patient-flow)                  |
| `/api/patients/events`                           | GET/POST         | eventos clínicos do paciente                             |
| `/api/related/[type]/[id]`                       | GET              | itens relacionados (heurístico)                          |
| `/api/search`                                    | GET              | busca semântica                                          |
| `/api/sentinel`                                  | POST             | hooks do sentinel health-scan                            |
| `/api/stats`                                     | GET              | stats agregadas pro dashboard                            |
| `/api/suggestions`                               | GET/POST         | sugestões produto                                        |
| `/api/system/health/[service]`                   | GET              | health check por serviço downstream                      |

### 2.6 Design principles (padrão visual enforced)

- **Zero neon / zero glow**: sombras sutis (4–8% preto), sem `shadow-glow`, sem `blur` decorativo.
- **Fundo branco puro, letras pretas sólidas**: `--color-bg-base: #ffffff`, `--text-primary: #0a0a0a`.
- **Um único azul** (`#2563eb`) para ações primárias. Sem gradientes.
- **Tipografia Inter primeiro**, Geist como fallback (15px base p/ legibilidade clínica).
- **Sidebar branca** (não mais navy escura desde v1.37.0).
- **Ícones Lucide** com tamanhos fixos `16/20/24`.
- **Focus visible sempre** via `outline: 2px solid var(--color-accent)`.

Ver também: [`docs/ui-quality/`](../../docs/ui-quality/).

---

## 3. Backend — `services/`

### 3.1 Lista de serviços

| Serviço                     | Porta | Stack    | Propósito                                              |
| --------------------------- | ----- | -------- | ------------------------------------------------------ |
| `@velya/patient-flow`       | 3001  | NestJS   | Admissão, transferência, alta, ocupação de leitos      |
| `@velya/discharge-orchestrator` | 3002 | NestJS | Workflow de alta (blockers, escalation, conclusão)    |
| `@velya/task-inbox`         | 3003  | NestJS   | Inbox de tarefas clínicas (SLA, escalation)            |
| `@velya/audit-service`      | 3004  | NestJS   | Audit log centralizado (hash chain + FHIR AuditEvent)  |

Todos usam `ValidationPipe` com `whitelist: true, forbidNonWhitelisted: true` e `enableShutdownHooks()`. Prefix global `/api/v1`.

Serviços de **plataforma** (velya-dev-platform, não em `services/`):

| Serviço                  | Porta | Propósito                                       |
| ------------------------ | ----- | ----------------------------------------------- |
| `ai-gateway`             | 3010  | Gateway único para provedores de LLM            |
| `agent-orchestrator`     | 3020  | Ponte NATS ↔ execução de agents                 |
| `policy-engine`          | 3030  | Decisões OPA/Rego de governança                 |
| `memory-service`         | 3040  | Memória compartilhada entre agents              |
| `decision-log-service`   | 3050  | Log imutável de decisões AI (WORM)              |

### 3.2 Packages compartilhados

| Package                     | Propósito                                                            |
| --------------------------- | -------------------------------------------------------------------- |
| `@velya/shared-kernel`      | Tipos base, errors, Result<T,E>, utils                               |
| `@velya/domain`             | Entidades e VOs de domínio hospitalar (`patient`, `task`)            |
| `@velya/event-contracts`    | Interfaces de eventos de domínio + `EVENT_TYPES` + `EVENT_SUBJECTS`  |
| `@velya/event-schemas`      | JSON Schemas AsyncAPI (só `src/`, sem package.json separado)         |
| `@velya/config`             | Carregamento de config + validação de ambiente                       |
| `@velya/observability`      | Logging estruturado, tracing OTel, métricas Prometheus               |
| `@velya/ai-contracts`       | Interfaces para abstração de providers AI                            |

### 3.3 Contratos de eventos NATS

Definidos em [`packages/event-contracts/src/events.ts`](../../packages/event-contracts/src/events.ts):

| `EVENT_TYPES` key          | Subject NATS                   |
| -------------------------- | ------------------------------ |
| `PATIENT_ADMITTED`         | `velya.patient.admitted`       |
| `PATIENT_DISCHARGED`       | `velya.patient.discharged`     |
| `TASK_CREATED`             | `velya.task.created`           |
| `TASK_COMPLETED`           | `velya.task.completed`         |
| `TASK_ESCALATED`           | `velya.task.escalated`         |
| `BED_ASSIGNED`             | `velya.bed.assigned`           |
| `BED_RELEASED`             | `velya.bed.released`           |

Payloads adicionais: `DISCHARGE_BLOCKER_CREATED`, `DISCHARGE_BLOCKER_RESOLVED`. Todos são `DomainEvent<T>` genéricos com `eventId`, `occurredAt`, `correlationId`, `causationId`, `actorId`.

### 3.4 FHIR + Medplum

- **Produção:** Medplum server + worker hospedados no namespace `medplum` (do cluster App em EKS).
- **Recursos** primários: `Patient`, `Encounter`, `Observation`, `MedicationRequest`, `DiagnosticReport`, `ServiceRequest`, `Condition`, `Procedure`, `AuditEvent`.
- **R4** com perfis brasileiros (RNDS quando aplicável).
- **Local (kind):** Medplum ainda não instanciado — `apps/web` usa entity-store em PVC como substituto.

### 3.5 Temporal workflows

**Status:** em produção (EKS App cluster, namespace `temporal`). No `kind` local **não está instanciado**.

Workflows previstos:

- `DischargeWorkflow` (orquestra blockers → approval → release bed → billing handoff)
- `AdmissionWorkflow` (triagem → leito → registo → notification)
- `TaskEscalationWorkflow` (SLA miss → notificar supervisor → rotear)

TODO: detalhar após implementação completa no cluster local.

---

## 4. Infraestrutura — Kubernetes (kind cluster)

### 4.1 Cluster topology

```text
$ kubectl --context kind-velya-local get nodes
NAME                        STATUS   ROLES           AGE    VERSION
velya-local-control-plane   Ready    control-plane   3d1h   v1.31.0
velya-local-worker          Ready    <none>          3d1h   v1.31.0
velya-local-worker2         Ready    <none>          3d1h   v1.31.0
velya-local-worker3         Ready    <none>          3d1h   v1.31.0
velya-local-worker4         Ready    <none>          3d1h   v1.31.0
```

- 5 nós Docker (1 control-plane + 4 workers), imagem kind 1.31.0.
- MetalLB entrega `172.19.0.100` como External IP do Service do `ingress-nginx`.
- Domínio curinga `*.172.19.0.6.nip.io` resolve para o host do podman/docker.
- Domínios `*.velya.local` dependem de entradas em `/etc/hosts`.

### 4.2 Namespaces

| Namespace                 | Propósito                                                     |
| ------------------------- | ------------------------------------------------------------- |
| `argocd`                  | GitOps operator                                               |
| `argo-rollouts`           | Progressive delivery (canary, blue-green)                     |
| `cert-manager`            | Emissão de certificados (Let's Encrypt / internal CA)         |
| `ingress-nginx`           | Controller de Ingress                                         |
| `metallb-system`          | LoadBalancer L2 em redes sem cloud                            |
| `local-path-storage`      | Default StorageClass no kind                                  |
| `monitoring`              | Futuros dashboards externos                                   |
| `velya-dev-agents`        | `agent-orchestrator` (ponte NATS ↔ Claude)                    |
| `velya-dev-core`          | `patient-flow`, `discharge-orchestrator`, `task-inbox`, `audit-service` |
| `velya-dev-platform`      | `ai-gateway`, `policy-engine`, `memory-service`, `decision-log-service`, `external-secrets`, NATS, PostgreSQL, autopilot CronJobs |
| `velya-dev-observability` | Prometheus, Grafana, Loki, Tempo, OTel Collector              |
| `velya-dev-web`           | `velya-web` (Next.js) + PVCs de sessão/audit/events           |
| `velya-system`            | Secrets TLS compartilhados (`*.velyahospitalar.com`)          |

### 4.3 Workloads por namespace

| Namespace                 | Deployments                                                                                                          | StatefulSets                         | DaemonSets                                    | CronJobs                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `velya-dev-agents`        | `agent-orchestrator` (1/1)                                                                                           | —                                    | —                                             | —                                                                                                                                                                                                                        |
| `velya-dev-core`          | `patient-flow`, `discharge-orchestrator`, `task-inbox`, `audit-service` (1/1 cada)                                   | —                                    | —                                             | `velya-agent-event-bridge` (*/2m), `velya-synthetic-monitor` (*/5m)                                                                                                                                                     |
| `velya-dev-platform`      | `ai-gateway`, `decision-log-service`, `memory-service`, `policy-engine`, `external-secrets`(x3)                      | `nats` (1/1), `postgresql` (1/1)     | —                                             | `velya-agent-health-manager` (*/30m), `velya-agent-runtime-supervisor` (0 * * * *), `velya-assurance-verification` (*/15m), `velya-cost-monitor-hourly`, `velya-daily-digest`, `velya-frontend-quality-agent` (0 */4), `velya-infra-health-agent` (*/15), `velya-meta-governance-auditor` (0 12), `velya-sentinel-health-scan` (*/5), `velya-watchdog-silence-detector` (*/10), `velya-weekly-drift-detector` (0 8 * * 1) |
| `velya-dev-observability` | `otel-collector`, `prometheus-grafana`, `prometheus-kube-prometheus-operator`, `prometheus-kube-state-metrics` (1/1) | `loki-chunks-cache`, `loki-results-cache`, `prometheus-…-prometheus` (0/1 degraded), `tempo` (1/1) | `loki-canary`, `prometheus-node-exporter`, `promtail` | —                                                                                                                                                                                                                        |
| `velya-dev-web`           | `velya-web` (1/1)                                                                                                    | —                                    | —                                             | —                                                                                                                                                                                                                        |

**Nota operacional:** `prometheus-prometheus-kube-prometheus-prometheus` está `0/1` nesta snapshot — entrou em estado degradado após upgrade. Monitorar via `infra-health-agent`.

### 4.4 Autoscaling

**ScaledObjects (KEDA):**

| Scaler                           | Alvo                     | Min/Max | Trigger                  |
| -------------------------------- | ------------------------ | ------- | ------------------------ |
| `agent-orchestrator-scaler`      | agent-orchestrator       | 1 / 3   | prometheus               |
| `patient-flow-scaler`            | patient-flow             | 1 / 5   | prometheus               |
| `discharge-orchestrator-scaler`  | discharge-orchestrator   | 1 / 4   | prometheus               |
| `task-inbox-scaler`              | task-inbox               | 1 / 5   | prometheus               |
| `ai-gateway-scaler`              | ai-gateway               | 1 / 6   | prometheus               |
| `velya-web-http-scaler`          | velya-web                | 1 / 4   | prometheus (HTTP RPS)    |

Todos geram HPAs `keda-hpa-*` automaticamente.

### 4.5 Redes

#### Ingresses

| Host                                   | Namespace                 | Backend                    |
| -------------------------------------- | ------------------------- | -------------------------- |
| `velya.172.19.0.6.nip.io`              | velya-dev-web             | velya-web                  |
| `velya.local`                          | velya-dev-web             | velya-web                  |
| `velyahospitalar.com` (+ app + api)    | velya-dev-web             | velya-web                  |
| `agents.172.19.0.6.nip.io`             | velya-dev-agents          | agent-orchestrator         |
| `patient-flow.172.19.0.6.nip.io`       | velya-dev-core            | patient-flow               |
| `discharge.172.19.0.6.nip.io`          | velya-dev-core            | discharge-orchestrator     |
| `task-inbox.172.19.0.6.nip.io`         | velya-dev-core            | task-inbox                 |
| `audit.172.19.0.6.nip.io`              | velya-dev-core            | audit-service              |
| `ai-gateway.172.19.0.6.nip.io`         | velya-dev-platform        | ai-gateway                 |
| `policy-engine.172.19.0.6.nip.io`      | velya-dev-platform        | policy-engine              |
| `memory-service.172.19.0.6.nip.io`     | velya-dev-platform        | memory-service             |
| `decision-log.172.19.0.6.nip.io`       | velya-dev-platform        | decision-log-service       |
| `grafana.172.19.0.6.nip.io`            | velya-dev-observability   | prometheus-grafana         |
| `prometheus.172.19.0.6.nip.io`         | velya-dev-observability   | prometheus                 |
| `argocd.172.19.0.6.nip.io`             | argocd                    | argocd-server              |

Todos com ingress class `nginx` e endereço `172.19.0.100`.

#### NetworkPolicies

Cada namespace velya-* possui defaults deny-all + allow-list específico (ingress só de `ingress-nginx`, `monitoring`, `velya-dev-web`; egress controlado para `nats`, `postgresql`, DNS, external-secrets). Declarados em [`infra/kubernetes/services/`](../../infra/kubernetes/services/).

#### Cloudflare Tunnel (produção)

- Termina em `velyahospitalar.com` e sub-hosts
- Encaminha para o ingress-nginx do cluster EKS App
- Bundle independente do repo em `/workspace/hub/autopilot/ops/docker/vscode-tunnel-cloud` (não dentro da aplicação)

### 4.6 Segurança

#### PriorityClasses

| PriorityClass          | Value     | Preempção | Uso                                        |
| ---------------------- | --------- | --------- | ------------------------------------------ |
| `velya-system-critical`| 1.000.000 | não       | ingress, cert-manager, DNS                 |
| `velya-core-high`      | 100.000   | não       | patient-flow, discharge, task-inbox, audit |
| `velya-platform-medium`| 50.000    | sim       | ai-gateway, policy-engine, memory-service  |
| `velya-agent-ai`       | 30.000    | não       | workloads AI/agents                        |
| `velya-batch`          | 10.000    | não       | CronJobs autopilot                         |
| `velya-batch-low`      | 10.000    | não       | jobs best-effort                           |

#### ResourceQuotas

Quotas por namespace velya-dev-* limitam CPU, memory, pods e PVCs. Declaradas em [`infra/kubernetes/base/`](../../infra/kubernetes/base/).

#### PodSecurity

Todos os namespaces velya-* aplicam o profile `restricted` (enforced + audit + warn). SecurityContext padrão:

```yaml
runAsNonRoot: true
runAsUser: 1000
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: [ALL]
seccompProfile:
  type: RuntimeDefault
```

### 4.7 Storage

| PVC                         | Namespace            | Tamanho | Conteúdo                              |
| --------------------------- | -------------------- | ------- | ------------------------------------- |
| `data-postgresql-0`         | velya-dev-platform   | 2 Gi    | PostgreSQL data dir                   |
| `nats-js-nats-0`            | velya-dev-platform   | 10 Gi   | NATS JetStream blocks                 |
| `velya-autopilot-data`      | velya-dev-platform   | 2 Gi    | **Evidence bus dos agents**           |
| `storage-tempo-0`           | velya-dev-observability | 5 Gi | Tempo traces                          |
| `velya-web-audit-pvc`       | velya-dev-web        | 5 Gi    | Audit logs do velya-web (hash chain)  |
| `velya-web-events-pvc`      | velya-dev-web        | 2 Gi    | Event store do velya-web              |
| `velya-web-users-pvc`       | velya-dev-web        | 1 Gi    | Sessions + user-store do velya-web    |

StorageClass única: `standard` (local-path-provisioner no kind).

### 4.8 Secrets

- **External Secrets Operator** (`external-secrets`, `external-secrets-webhook`, `external-secrets-cert-controller`) instalado em `velya-dev-platform`.
- **Backend:** AWS Secrets Manager em produção; **LocalStack** no kind via `aws-localstack-credentials` Secret.
- **Bootstrap:** `scripts/localstack-bootstrap.sh` cria secrets simulados.
- **TLS certs compartilhados:** `velya-system` ns tem 8 Secrets `*-tls` para os hosts `velyahospitalar.com`.
- **Nunca** commitar tokens — toda injeção passa pelo ESO → `Secret` nativo.

### 4.9 cert-manager + TLS

- Namespace `cert-manager` com ClusterIssuer `letsencrypt-prod` (produção).
- No kind, TLS usa certificado self-signed compartilhado `velya-local-tls` (presente em todos namespaces velya-*).
- HSTS preload habilitado no middleware do velya-web.

### 4.10 ArgoCD applications

```text
$ kubectl get applications -n argocd
NAME                      SYNC STATUS   HEALTH STATUS
velya-agents              Synced        Healthy
velya-bootstrap           OutOfSync     Missing
velya-core-services       Synced        Healthy
velya-platform-root       Synced        Healthy
velya-platform-services   Synced        Healthy
```

Estrutura **App-of-Apps** partindo de [`infra/argocd/app-of-apps.yaml`](../../infra/argocd/app-of-apps.yaml):

- `velya-platform-root` → gerencia todos os filhos
- `velya-core-services` → `services/velya-dev-core/*.yaml`
- `velya-platform-services` → `services/velya-dev-platform/*.yaml`
- `velya-agents` → `services/velya-dev-agents/*.yaml`
- `velya-bootstrap` → infra base (OutOfSync/Missing é esperado depois de `./scripts/kind-setup.sh`, que cria fora do ArgoCD)

---

## 5. Autopilot — hierarquia de 4 camadas

### 5.1 Diagrama

```text
                    ┌────────────────────────────────┐
                    │  Layer 4 — Executive Council   │
                    │      governance-council        │
                    └──────────────┬─────────────────┘
                                   │  escala só para decisões sistêmicas
                    ┌──────────────┴─────────────────┐
                    │  Layer 3 — Governors           │
                    │  meta-governance-auditor       │
                    │  agent-governance-reviewer     │
                    │  red-team-manager-agent        │
                    │  clinical-safety-gap-hunter    │
                    │  blind-spot-discovery-coord    │
                    │  governance-failure-analyst    │
                    └──────────────┬─────────────────┘
                                   │  aprova/bloqueia
                    ┌──────────────┴─────────────────┐
                    │  Layer 2 — Managers            │
                    │  agent-health-manager          │
                    │  agent-runtime-supervisor      │
                    │  delegation-coordinator-agent  │
                    └──────────────┬─────────────────┘
                                   │  supervisiona L1
                    ┌──────────────┴─────────────────┐
                    │  Layer 1 — Workers             │
                    │  frontend-quality-agent        │
                    │  backend-quality-agent         │
                    │  infra-health-agent            │
                    │  ui-audit-agent                │
                    │  marketing-copy-agent          │
                    └────────────────────────────────┘
                                   │
                                   ▼
                    ┌────────────────────────────────┐
                    │  Evidence bus (PVC shared)     │
                    │  velya-autopilot-data          │
                    └────────────────────────────────┘
```

### 5.2 Layer 1 — Workers

| Agent                         | Schedule     | Scope                                                      | Fonte                                                                     |
| ----------------------------- | ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `frontend-quality-agent`      | `0 */4 * * *` | typecheck, lint, build, visual regression, contrast, a11y | [.claude/agents/frontend-quality-agent.md](../../.claude/agents/frontend-quality-agent.md) |
| `backend-quality-agent`       | ad-hoc (CI)  | test suite, coverage, deps audit, dead code                | [.claude/agents/backend-quality-agent.md](../../.claude/agents/backend-quality-agent.md) |
| `infra-health-agent`          | `*/15 * * * *` | cluster state, KEDA, HPAs, CronJobs, ArgoCD drift        | [.claude/agents/infra-health-agent.md](../../.claude/agents/infra-health-agent.md) |
| `ui-audit-agent`              | diário       | screenshots Playwright, design drift, UX anti-patterns    | [.claude/agents/ui-audit-agent.md](../../.claude/agents/ui-audit-agent.md) |
| `marketing-copy-agent`        | semanal      | audita strings user-facing (PT-BR clinical voice)         | [.claude/agents/marketing-copy-agent.md](../../.claude/agents/marketing-copy-agent.md) |
| `delegation-coordinator-agent`| contínuo     | roteia findings, enforced validation chain                | [.claude/agents/delegation-coordinator-agent.md](../../.claude/agents/delegation-coordinator-agent.md) |

Cada worker tem:
- Um script TypeScript em [`scripts/agents/run-*.ts`](../../scripts/agents/)
- Um CronJob correspondente (para os que rodam in-cluster) em [`infra/kubernetes/autopilot/agents-cronjobs.yaml`](../../infra/kubernetes/autopilot/agents-cronjobs.yaml)
- Grava evidence em `/data/velya-autopilot/<agent>/<timestamp>.json` no PVC compartilhado

### 5.3 Layer 2 — Managers

| Manager                      | Schedule       | Responsabilidade                                        |
| ---------------------------- | -------------- | ------------------------------------------------------- |
| `agent-health-manager`       | `*/30 * * * *` | Detecta jobs travados, silence, failure patterns em L1 |
| `agent-runtime-supervisor`   | `0 * * * *`    | Higiene operacional: poda evidence antigo, valida PVC, image pinning, revive CronJobs travados |

Ambos rodam como CronJob no `velya-dev-platform` com `ServiceAccount velya-autopilot-sa` e `ClusterRole velya-autopilot-reader` + `velya-autopilot-remediator`.

**Observação operacional atual:** nesta snapshot, os jobs do `agent-health-manager` e `agent-runtime-supervisor` aparecem como `Failed 0/1` nas últimas execuções (29598990, 29599020). Investigar imagem pinned + resource quota. O meta-gov-demo rodou com sucesso (1/1 Complete, 6s).

### 5.4 Layer 3 — Governors

| Governor                              | Status     | Schedule       | Papel                                      |
| ------------------------------------- | ---------- | -------------- | ------------------------------------------ |
| `meta-governance-auditor`             | in-cluster | `0 12 * * *`   | Audita governadores-de-governadores        |
| `agent-governance-reviewer`           | doc only   | —              | Revisa mudanças de policy dos agents       |
| `red-team-manager-agent`              | doc only   | —              | Red-teaming de decisões                    |
| `clinical-safety-gap-hunter-agent`    | doc only   | —              | Busca gaps em segurança clínica            |
| `blind-spot-discovery-coordinator-agent` | doc only | —              | Descobre blind spots no monitoring         |
| `governance-failure-analyst-agent`    | doc only   | —              | Analisa modos de falha de governança       |

### 5.5 Layer 4 — Executive Council

| Council              | Invocação | Papel                                                               |
| -------------------- | --------- | ------------------------------------------------------------------- |
| `governance-council` | ad-hoc    | Arbitra conflitos entre agents, bloqueia mudanças sistêmicas, aprova cross-domain |

Triggerado apenas quando `delegation-coordinator-agent` detecta conflito entre recomendações ou quando uma mudança toca mais de 2 domínios. É a última autoridade antes de um PR sistêmico ser mergeado.

### 5.6 Evidence bus

- **PVC:** `velya-autopilot-data` (2 Gi, RWO) em `velya-dev-platform`
- **Mount path:** `/data/velya-autopilot`
- **Estrutura:**
  ```text
  /data/velya-autopilot/
  ├── frontend-quality/
  │   └── 2026-04-11T19-00-00Z.json
  ├── infra-health/
  │   └── 2026-04-11T19-15-00Z.json
  ├── agent-health-manager/
  ├── meta-governance-auditor/
  └── index.json             ← hash chain global
  ```
- **Formato do JSON:**
  ```json
  {
    "agent": "frontend-quality",
    "timestamp": "2026-04-11T19:00:00Z",
    "runId": "29598990",
    "prevHash": "sha256:…",
    "hash": "sha256:…",
    "findings": [ { "severity": "high", "route": "/beds", "rule": "…", "evidence": "…" } ],
    "remediationsApplied": [ … ],
    "handoffs": [ { "to": "delegation-coordinator-agent", "reason": "…" } ]
  }
  ```
- **Leitura:** o `evidence-reader` pod pattern usa `kubectl run --rm -it evidence-reader --image=alpine --restart=Never --overrides='{"spec":{"containers":[…mount PVC readOnly…]}}' -- cat /data/velya-autopilot/…`

### 5.7 RBAC dos agents

- **ServiceAccount:** `velya-autopilot-sa` em `velya-dev-platform`
- **ClusterRoles:**
  - `velya-autopilot-reader` — get/list/watch de pods, deployments, cronjobs, jobs, services, ingresses, configmaps, scaledobjects, hpas, applications.argoproj.io (cluster-wide)
  - `velya-autopilot-remediator` — patch/delete limitado para remediações safe (restart de CronJob travado, sync ArgoCD, restart deployment)
- **Role:** `namespace-remediator` em `velya-dev-*` para delete de Jobs completos, patch de Deployments específicos.

### 5.8 Validation chain

Cada camada só valida a imediatamente inferior:

```text
L4 Council         validates→ L3 Governors     (quando escalado)
L3 Governors       validates→ L2 Managers      (diário)
L2 Managers        validates→ L1 Workers       (cada run)
L1 Workers         validates→ velya-web/services/infra (reais)
```

Isso é enforced pelo `meta-governance-auditor` (L3) que verifica que cada governador produziu evidence não-vazio no PVC **e** seguiu sua `validates` declarada no front-matter do agent `.md`.

---

## 6. Deep UI Audit Engine

Engine Playwright headless rodando em [`scripts/ui-audit/deep-audit.ts`](../../scripts/ui-audit/deep-audit.ts).

**Como roda:**

```bash
# 1. Instala Chromium + faz login com cookie injection
# 2. Enumera rotas dinamicamente (API /api/routes ou navega sidebar)
# 3. Para cada rota:
#    - Screenshot full-page
#    - Extrai computed styles de todos os elementos visíveis
#    - Aplica 7 checks
# 4. Grava relatório em /tmp/velya-audit/deep-audit/<timestamp>/report.json + report.md
```

**7 tipos de checks:**

1. **Contrast** — WCAG AA (4.5:1 normal, 3:1 large) usando `color` vs `background-color` computed
2. **Z-index stacking** — sobreposição inesperada (tooltip atrás de modal etc)
3. **Empty states** — listas vazias sem feedback
4. **Broken links** — hrefs com 404
5. **Icon-only buttons sem aria-label**
6. **Focus visible** — outline removido sem substituto
7. **Brand voice PT-BR** — strings em EN ou inconsistentes

**Autenticação:** cookie injection via `POST /api/auth/login` salvo num `storageState.json` reutilizado.

**Enumeração de rotas:** dinâmica — navega sidebar extraindo `<Link href>` + descobre rotas `[param]` via probing.

**Último run (2026-04-11T21:04:07Z):**

- **Total findings:** 588
- **Severidade:** 0 critical · 236 high · 352 medium · 0 low
- **Rotas cobertas:** 65 (todas do `page.tsx`)
- **Top rotas com findings:** `/`, `/activity`, `/agents`, `/alerts`, `/assets`, `/audit`, `/beds`, `/billing/*`

Os 236 `high` são principalmente contraste AA em badges e helper text; os 352 `medium` são majoritariamente empty states sem ilustração.

---

## 7. Observabilidade

**Stack:**

| Componente           | Kind        | Porta scrape | Observação                                |
| -------------------- | ----------- | ------------ | ----------------------------------------- |
| `prometheus-…-prometheus` | StatefulSet | 9090  | kube-prometheus-stack v8.x                |
| `prometheus-grafana` | Deployment  | 80           | admin user em Secret `prometheus-grafana` |
| `tempo`              | StatefulSet | 3200 (API)   | Traces OTel                               |
| `loki`               | stateful    | 3100         | + chunks-cache + results-cache stateful   |
| `otel-collector`     | Deployment  | 4317/4318    | OTLP gRPC + HTTP                          |
| `promtail`           | DaemonSet   | —            | tail de `/var/log/pods`                   |
| `node-exporter`      | DaemonSet   | 9100         | métricas de kernel/host                   |
| `loki-canary`        | DaemonSet   | 3500         | canário de loss de logs                   |

**Dashboards Grafana pré-configurados** (via ConfigMaps):

- `grafana-dashboard-velya-platform-overview`
- `grafana-dashboard-velya-clinical`
- `grafana-dashboard-velya-infrastructure`
- `grafana-dashboard-queue-health`
- `grafana-dashboard-runtime-pressure`

**Alerting:**

- `alertmanager-velya-config` — políticas de notificação
- `grafana-alerting-contact-points` — Slack/e-mail/webhook
- `grafana-alerting-notification-policy` — matriz de severidade
- 38 rulefiles em `prometheus-prometheus-…-rulefiles-0`

**OpenTelemetry Collector** centraliza traces/metrics/logs vindo dos serviços NestJS (via `@velya/observability` package → OTLP HTTP para `otel-collector-opentelemetry-collector:4318`).

---

## 8. CI/CD — GitHub Actions

### 8.1 Workflows declarados

| Arquivo                           | Trigger                             | Propósito                                                            |
| --------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `ci.yaml`                         | push + PR                           | Lint, typecheck, unit tests (frontend + backend + packages)          |
| `deploy-web.yaml`                 | push `main` + tag                   | Build Docker velya-web → push ECR → kubectl apply → ArgoCD sync      |
| `release.yaml`                    | manual + tag                        | Bump versão, gera CHANGELOG, cria GitHub Release                     |
| `version-bump.yaml`               | manual                              | Bump de major/minor/patch coordenado no monorepo                     |
| `security.yaml`                   | push + weekly                       | CodeQL, dependency review                                            |
| `security-supply-chain.yaml`      | push + PR                           | SLSA provenance, Trivy, syft SBOM                                    |
| `platform-validation.yaml`        | workflow_dispatch                   | Roda `validate-platform.sh` num cluster ephemeral                    |
| `visual-test.yaml`                | PR                                  | Regressão visual via Playwright screenshots                          |
| `ui-audit-daily.yaml`             | `0 6 * * *`                         | Roda o `deep-audit.ts` nightly e abre issues                         |
| `ui-quality.yaml`                 | PR                                  | Contrast + a11y check                                                |
| `autopilot-agents-ci.yaml`        | push `.claude/agents/**`            | Valida front-matter dos agents, lint markdown                        |
| `autopilot-auto-merge.yaml`       | PR label `autopilot`                | Auto-merge de PRs gerados por agents se checks passam                |

### 8.2 Pipeline típico do `velya-web`

```text
 push main
    │
    ▼
 CI (lint + type + test + build)
    │
    ▼
 deploy-web.yaml
    │
    ├─ docker build -f infra/docker/velya-web.Dockerfile
    ├─ trivy scan image
    ├─ cosign sign
    ├─ push ECR
    ├─ kubectl set image deployment/velya-web velya-web=<digest> -n velya-dev-web
    └─ argocd app sync velya-platform-root --prune
```

### 8.3 Autopilot agents CI

- Valida front-matter YAML de cada `.claude/agents/*.md`
- Verifica que o campo `description` existe
- Roda `markdownlint`
- Garante que cada agent in-cluster tem CronJob correspondente em `infra/kubernetes/autopilot/agents-cronjobs.yaml`

---

## 9. Auditoria e compliance

### 9.1 Hash chain de auditoria

- Todo request autenticado passa pelo `middleware.ts` que emite log estruturado `audit: true` em stdout
- API routes escrevem em `velya-web-audit-pvc` via [`lib/audit-logger.ts`](../../apps/web/src/lib/audit-logger.ts)
- Cada entrada encadeada por `prevHash` (SHA-256 do evento anterior) — qualquer adulteração detectável
- Log de decisões AI vai para o `decision-log-service` (WORM)

### 9.2 LGPD (Lei Geral de Proteção de Dados)

- Classes de dado A–E em `access-control.ts` implementam minimização por role
- Consent forms gerenciados em `/governance/consent-forms`
- Right-to-erasure via DELETE em `entity-store` (soft-delete com TTL + hard-delete via job)
- Data residency: PVCs em clusters Brasil (produção `sa-east-1`)

### 9.3 HIPAA alignment

- Access levels 0–7 mapeiam para minimum-necessary
- Break-glass auditado com `auditLevel: maximum`
- TLS em trânsito + at-rest via KMS (produção)

### 9.4 CFM Resolução 2.314/22 (telemedicina)

- Assinatura digital pendente (perfil ICP-Brasil) — TODO: verificar implementação atual
- Registro de prescrições com carimbo temporal
- Prontuário rastreável via `event-store` + hash chain

### 9.5 HL7 FHIR R4

- Resources principais já mapeados (ver §3.4)
- Perfis brasileiros (RNDS) aplicáveis — TODO: validar conformance completa
- AuditEvent recurso canônico (alinhado com `audit-service`)

---

## 10. Runbook operacional

### 10.1 Deploy local

```bash
# Bootstrap completo do cluster
./scripts/kind-setup.sh       # cria kind + metallb + ingress-nginx + argocd
./scripts/localstack-bootstrap.sh  # secrets simulados
./scripts/deploy.sh           # build + apply + argocd sync
./scripts/validate-platform.sh # smoke E2E
```

### 10.2 Deploy incremental do velya-web

```bash
./scripts/deploy-web.sh
# equivale a:
#   docker build -f infra/docker/velya-web.Dockerfile -t velya-web:local .
#   kind load docker-image velya-web:local --name velya-local
#   kubectl rollout restart deployment/velya-web -n velya-dev-web
#   kubectl rollout status deployment/velya-web -n velya-dev-web
```

### 10.3 Trigger manual de um agent CronJob

```bash
kubectl --context kind-velya-local create job \
  --from=cronjob/velya-frontend-quality-agent \
  velya-frontend-quality-manual-$(date +%s) \
  -n velya-dev-platform

kubectl logs -n velya-dev-platform job/velya-frontend-quality-manual-… -f
```

### 10.4 Ler evidence JSON do PVC

```bash
kubectl --context kind-velya-local run evidence-reader \
  --rm -it --restart=Never \
  --image=alpine \
  --overrides='{"spec":{"containers":[{"name":"r","image":"alpine","command":["sh"],"stdin":true,"tty":true,"volumeMounts":[{"name":"d","mountPath":"/data"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"velya-autopilot-data","readOnly":true}}]}}' \
  -n velya-dev-platform -- sh
# dentro do pod:
ls /data/velya-autopilot/
cat /data/velya-autopilot/frontend-quality/*.json | head
```

### 10.5 Rollback

```bash
# Rollback de deployment
kubectl rollout undo deployment/velya-web -n velya-dev-web

# Rollback via ArgoCD para revisão anterior
argocd app rollback velya-platform-root <REVISION>

# Rollback de tag git (para releases)
git revert <merge-commit> && git push
# CI abre PR de revert e redeploya
```

### 10.6 Rotate sessions (forçar logout global)

```bash
kubectl exec -n velya-dev-web deploy/velya-web -- \
  sh -c 'rm -rf /tmp/velya-sessions/*.json'
# próximo request redireciona todo mundo pra /login
```

### 10.7 Debugar um serviço

```bash
# Port-forward local
kubectl port-forward -n velya-dev-core svc/patient-flow 3001:3001 &
curl http://localhost:3001/api/v1/health

# Logs estruturados
kubectl logs -n velya-dev-core deploy/patient-flow -f | jq .

# Exec no pod
kubectl exec -it -n velya-dev-core deploy/patient-flow -- sh
```

---

## 11. URLs e endpoints

| URL                                        | Ambiente | Protegido |
| ------------------------------------------ | -------- | --------- |
| `https://velyahospitalar.com`              | prod     | sim       |
| `https://app.velyahospitalar.com`          | prod     | sim       |
| `https://api.velyahospitalar.com`          | prod     | sim       |
| `https://grafana.velyahospitalar.com`      | prod     | sim       |
| `https://argocd.velyahospitalar.com`       | prod     | sim       |
| `http://velya.172.19.0.6.nip.io`           | kind     | sim (cookie) |
| `http://patient-flow.172.19.0.6.nip.io`    | kind     | interno   |
| `http://discharge.172.19.0.6.nip.io`       | kind     | interno   |
| `http://task-inbox.172.19.0.6.nip.io`      | kind     | interno   |
| `http://audit.172.19.0.6.nip.io`           | kind     | interno   |
| `http://agents.172.19.0.6.nip.io`          | kind     | interno   |
| `http://ai-gateway.172.19.0.6.nip.io`      | kind     | interno   |
| `http://policy-engine.172.19.0.6.nip.io`   | kind     | interno   |
| `http://memory-service.172.19.0.6.nip.io`  | kind     | interno   |
| `http://decision-log.172.19.0.6.nip.io`    | kind     | interno   |
| `http://grafana.172.19.0.6.nip.io`         | kind     | admin     |
| `http://prometheus.172.19.0.6.nip.io`      | kind     | admin     |
| `http://argocd.172.19.0.6.nip.io`          | kind     | admin     |

---

## 12. Contatos e ownership

| Papel                  | Quem                                   |
| ---------------------- | -------------------------------------- |
| Founder / CEO          | João Freire                            |
| E-mail platform        | velyaplatform@gmail.com                |
| Repositório            | `velyaplatform/velya-platform`         |
| Labels GitHub autopilot| `autopilot/frontend`, `autopilot/backend`, `autopilot/infra`, `autopilot/ui`, `autopilot/copy`, `autopilot/governance` |
| Config ArgoCD          | `infra/argocd/app-of-apps.yaml`        |
| Canal de incidentes    | issue GitHub + manager-on-call         |

---

## Apêndice A: Últimos 10 commits relevantes

```text
c3a438b chore(release): v1.39.0
4140912 feat(autopilot): hierarquia de 4 camadas + VelyaCombobox + bulk fixes
191ccca chore(release): v1.38.1
b1b9a62 fix(web): remove light-on-light + abreviações expandidas
54d7c14 chore(release): v1.38.0
6dc63e8 feat: bateria de testes paralela + fixes + agents autonomos in-cluster
ea6909a chore(release): v1.37.1
ab7a6c8 fix(web): ícones Mail/Lock sobrepondo placeholder do Input (pixel validation)
fd49ce4 chore(release): v1.37.0
7673b16 feat(web): padrão puro branco + agents autônomos de UI e copy
```

---

## Apêndice B: Árvore de arquivos relevantes

```text
velya-platform/
├── apps/
│   └── web/                          ← Next.js 15 app
│       ├── next.config.ts
│       ├── middleware.ts
│       ├── package.json
│       └── src/
│           ├── middleware.ts         ← CSP, rate-limit, auth
│           ├── lib/
│           │   ├── access-control.ts ← RBAC 30 roles × 19 actions × 5 data classes
│           │   ├── auth-session.ts   ← file-based sessions /tmp/velya-sessions
│           │   ├── audit-logger.ts
│           │   ├── entity-store.ts
│           │   ├── event-store.ts
│           │   ├── cron-jobs.ts + cron-scheduler.ts + cron-runners.ts
│           │   ├── agent-runtime.ts + agent-loop.ts + agent-state.ts
│           │   ├── ai-agent-orchestrator.ts + ai-tools.ts
│           │   ├── clinical-alerts-store.ts
│           │   ├── delegation-store.ts + handoff-store.ts + oncall-store.ts
│           │   ├── user-store.ts + favorites-store.ts + following-store.ts
│           │   ├── module-manifest.ts + entity-resolver.ts
│           │   ├── semantic-search.ts
│           │   └── learning-curator.ts
│           └── app/
│               ├── layout.tsx + globals.css + page.tsx
│               ├── api/ …            ← 40+ route.ts
│               ├── components/
│               │   ├── ui/           ← 13 primitives
│               │   └── velya/        ← 12 domain components
│               └── <feature>/page.tsx × 65
├── services/
│   ├── patient-flow/                 ← NestJS :3001
│   ├── discharge-orchestrator/       ← NestJS :3002
│   ├── task-inbox/                   ← NestJS :3003
│   └── audit-service/                ← NestJS :3004
├── packages/
│   ├── shared-kernel/
│   ├── domain/
│   ├── event-contracts/
│   ├── event-schemas/
│   ├── config/
│   ├── observability/
│   └── ai-contracts/
├── infra/
│   ├── argocd/
│   │   └── app-of-apps.yaml
│   ├── bootstrap/
│   ├── docker/
│   │   ├── velya-web.Dockerfile
│   │   ├── velya-service.Dockerfile
│   │   └── velya-autopilot-agents.Dockerfile
│   ├── helm/
│   │   └── velya-service/            ← chart genérico (deployment, svc, hpa, pdb, sa)
│   ├── kubernetes/
│   │   ├── apps/                     ← velya-web ingress
│   │   ├── base/                     ← quotas, priorityclasses, netpolicies
│   │   ├── platform/
│   │   ├── services/
│   │   │   ├── velya-dev-agents/
│   │   │   ├── velya-dev-core/
│   │   │   └── velya-dev-platform/
│   │   ├── overlays/
│   │   └── autopilot/
│   │       └── agents-cronjobs.yaml  ← ServiceAccount + Roles + 5 CronJobs
│   ├── github-actions/
│   └── opentofu/
├── scripts/
│   ├── kind-setup.sh + deploy.sh + deploy-web.sh
│   ├── validate-platform.sh + verify.sh + cleanup.sh
│   ├── localstack-bootstrap.sh + port-forward-dev.sh + tunnel.sh
│   ├── agents/run-*.ts               ← 6 runners
│   └── ui-audit/
│       ├── deep-audit.ts
│       ├── detect-issues.ts
│       └── screenshot-key-pages.ts
├── .github/workflows/                ← 12 workflows
├── .claude/
│   └── agents/                       ← 40 agents .md (L1–L4)
└── docs/
    ├── architecture/                 ← este documento vive aqui
    └── ui-quality/
```

---

## Apêndice C: Glossário clínico

| Termo       | Significado                                                         |
| ----------- | ------------------------------------------------------------------- |
| **NEWS2**   | National Early Warning Score 2 — score de deterioração clínica      |
| **MRN**     | Medical Record Number — identificador único do prontuário           |
| **TMI**     | Tempo Médio de Internação                                           |
| **Handoff**| Passagem de plantão formal entre profissionais                      |
| **Break-glass** | Acesso de emergência fora do RBAC normal (auditado maximum)    |
| **On-call** | Escala de plantão                                                   |
| **Triagem** | Classificação inicial de urgência (Manchester/ESI)                  |
| **Discharge blocker** | Impedimento documentado para alta (lab pendente, transporte etc) |
| **Encounter**| FHIR resource que representa uma internação/consulta              |
| **Observation**| FHIR resource para resultado laboratorial ou sinal vital         |
| **RNDS**    | Rede Nacional de Dados em Saúde (Ministério da Saúde)               |
| **ICP-Brasil** | Infraestrutura de Chaves Públicas Brasileira (assinatura digital) |
| **CFM 2.314/22** | Resolução CFM sobre telemedicina                                |
| **COFEN**   | Conselho Federal de Enfermagem                                      |
| **LGPD**    | Lei Geral de Proteção de Dados (Lei 13.709/2018)                    |
| **PVC**     | PersistentVolumeClaim (Kubernetes)                                  |
| **KEDA**    | Kubernetes Event-Driven Autoscaler                                  |
| **ESO**     | External Secrets Operator                                           |
| **SLSA**    | Supply-chain Levels for Software Artifacts                          |
| **WORM**    | Write Once Read Many (storage imutável)                             |

---

**Fim do documento.** Para contribuir com atualizações, editar este arquivo e abrir PR com label `docs`. O `infra-health-agent` e `meta-governance-auditor` detectam drift factual (ex: CronJob schedule mudou mas doc não) e criam issues automaticamente.
