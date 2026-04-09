# Estrutura de Pastas por Feature — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Aplica-se a:** `apps/web/src`

---

## 1. Visão Geral

A aplicação web Velya organiza o código por camadas horizontais (compartilhadas) e domínios verticais (features). Esta estrutura equilibra reutilização com isolamento, permitindo que equipes trabalhem em domínios independentes sem conflitos.

### 1.1 Princípios de Organização

1. **Feature-first**: Código de um domínio vive junto
2. **Shared é explícito**: Componentes compartilhados em `/components`, nunca em features
3. **Colocation**: Testes, tipos, schemas e hooks junto do código que usam
4. **Imports unidirecionais**: Features não importam de outras features
5. **Barrel exports**: Cada feature exporta via index.ts
6. **Convenção sobre configuração**: Nomes previsíveis, sem decisões ad-hoc

---

## 2. Estrutura Raiz (`src/`)

```
src/
├── app/                    # Next.js App Router — rotas e layouts
├── components/             # Componentes compartilhados (UI primitives)
├── features/               # Domínios verticais (business logic + UI)
├── lib/                    # Utilitários, configurações, clients
├── hooks/                  # Hooks compartilhados (cross-feature)
├── types/                  # Tipos globais e shared interfaces
├── schemas/                # Zod schemas compartilhados
├── services/               # API clients e data fetching
├── providers/              # React context providers
├── styles/                 # CSS global, tokens, themes
├── config/                 # Constantes, feature flags, env
└── middleware.ts            # Next.js middleware
```

### 2.1 Responsabilidade de Cada Camada

| Pasta         | Responsabilidade                           | Exemplos                                            |
| ------------- | ------------------------------------------ | --------------------------------------------------- |
| `app/`        | Rotas, layouts, loading, error boundaries  | `page.tsx`, `layout.tsx`, `loading.tsx`             |
| `components/` | UI primitives reutilizáveis, design system | `Button`, `Card`, `DataTable`, `StatusChip`         |
| `features/`   | Lógica e UI de domínio específico          | `PatientTable`, `MedicationForm`, `HandoffWizard`   |
| `lib/`        | Utilitários puros, configurações de libs   | `auth.ts`, `utils.ts`, `query-client.ts`            |
| `hooks/`      | Hooks compartilhados entre features        | `useDebounce`, `useMediaQuery`, `useLocalStorage`   |
| `types/`      | Tipos e interfaces globais                 | `User`, `Session`, `ApiResponse`, `PaginatedResult` |
| `schemas/`    | Zod schemas compartilhados                 | `paginationSchema`, `dateRangeSchema`               |
| `services/`   | Funções de fetch, API abstraction          | `api.ts`, `patients.ts`, `medications.ts`           |
| `providers/`  | Context providers globais                  | `QueryProvider`, `ThemeProvider`, `SessionProvider` |
| `styles/`     | CSS global e tokens                        | `globals.css`, `tokens.css`                         |
| `config/`     | Constantes e configuração                  | `routes.ts`, `permissions.ts`, `feature-flags.ts`   |

---

## 3. Camada `app/` — Roteamento

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   └── layout.tsx
│
├── (platform)/
│   ├── layout.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── patients/
│   │   ├── page.tsx
│   │   ├── [patientId]/
│   │   │   ├── page.tsx
│   │   │   ├── journey/page.tsx
│   │   │   ├── medications/page.tsx
│   │   │   ├── pain/page.tsx
│   │   │   ├── calls/page.tsx
│   │   │   └── layout.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── medication/
│   ├── calls/
│   ├── handoff/
│   ├── workforce/
│   ├── command-center/
│   ├── agents/
│   ├── admin/
│   └── observability/
│
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── health/route.ts
│   └── bff/
│
├── layout.tsx
├── not-found.tsx
├── error.tsx
└── global-error.tsx
```

**Regras para `app/`:**

- Somente arquivos de rota (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`)
- Sem lógica de negócio — delega para `features/`
- Server Components por padrão
- Imports de `features/` para componentes de domínio
- Imports de `components/` para UI primitives

---

## 4. Camada `components/` — Design System

```
components/
├── ui/                     # shadcn/ui components (auto-gerados + custom)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── table.tsx
│   ├── form.tsx
│   ├── toast.tsx
│   ├── skeleton.tsx
│   ├── badge.tsx
│   ├── alert.tsx
│   ├── tabs.tsx
│   ├── tooltip.tsx
│   ├── popover.tsx
│   ├── command.tsx
│   ├── sheet.tsx
│   └── separator.tsx
│
├── layout/                 # Componentes de layout da aplicação
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── breadcrumbs.tsx
│   ├── page-header.tsx
│   ├── mobile-nav.tsx
│   └── footer.tsx
│
├── data/                   # Componentes de dados reutilizáveis
│   ├── data-table.tsx          # Wrapper TanStack Table padronizado
│   ├── data-table-toolbar.tsx
│   ├── data-table-pagination.tsx
│   ├── data-table-column-header.tsx
│   ├── data-table-row-actions.tsx
│   ├── data-table-faceted-filter.tsx
│   ├── data-table-view-options.tsx
│   └── data-table-skeleton.tsx
│
├── feedback/               # Componentes de feedback
│   ├── empty-state.tsx
│   ├── error-state.tsx
│   ├── loading-state.tsx
│   ├── degraded-banner.tsx
│   ├── confirmation-dialog.tsx
│   └── audit-confirmation.tsx
│
├── charts/                 # Wrappers de Recharts padronizados
│   ├── area-chart.tsx
│   ├── bar-chart.tsx
│   ├── line-chart.tsx
│   ├── pie-chart.tsx
│   └── metric-card.tsx
│
├── domain/                 # Componentes de domínio compartilhados
│   ├── status-chip.tsx
│   ├── timeline.tsx
│   ├── timeline-item.tsx
│   ├── patient-avatar.tsx
│   ├── pain-scale-indicator.tsx
│   ├── ai-badge.tsx
│   └── audit-trail.tsx
│
└── primitives/             # Componentes primitivos customizados
    ├── kbd.tsx
    ├── heading.tsx
    ├── text.tsx
    ├── stack.tsx
    └── inline.tsx
```

**Regras para `components/`:**

- Sem lógica de negócio — apenas apresentação e interação genérica
- Props tipadas com interfaces explícitas
- Storybook-ready (quando implementado)
- Acessibilidade nativa (ARIA, keyboard)
- Documentação via JSDoc em cada componente

---

## 5. Camada `features/` — Domínios Verticais

### 5.1 Estrutura de uma Feature

```
features/
├── <feature-name>/
│   ├── components/         # Componentes React do domínio
│   │   ├── feature-list.tsx
│   │   ├── feature-form.tsx
│   │   ├── feature-detail.tsx
│   │   └── feature-card.tsx
│   ├── hooks/              # Hooks específicos do domínio
│   │   ├── use-feature-query.ts
│   │   ├── use-feature-mutation.ts
│   │   └── use-feature-filters.ts
│   ├── schemas/            # Zod schemas do domínio
│   │   ├── create-schema.ts
│   │   ├── update-schema.ts
│   │   └── filter-schema.ts
│   ├── types/              # Tipos específicos do domínio
│   │   └── index.ts
│   ├── services/           # API calls do domínio
│   │   └── api.ts
│   ├── utils/              # Utilitários do domínio
│   │   └── formatters.ts
│   ├── constants/          # Constantes do domínio
│   │   └── index.ts
│   ├── actions/            # Server Actions (Next.js)
│   │   └── mutations.ts
│   └── index.ts            # Barrel export
```

### 5.2 Features Mapeadas

#### 5.2.1 `features/auth`

Autenticação, login, recuperação de senha, sessão.

```
features/auth/
├── components/
│   ├── login-form.tsx
│   ├── forgot-password-form.tsx
│   ├── reset-password-form.tsx
│   ├── session-expiry-dialog.tsx
│   ├── lock-screen.tsx
│   └── reauth-dialog.tsx
├── hooks/
│   ├── use-session.ts
│   ├── use-permissions.ts
│   └── use-reauth.ts
├── schemas/
│   ├── login-schema.ts
│   └── reset-password-schema.ts
├── types/
│   └── index.ts
├── services/
│   └── auth-api.ts
└── index.ts
```

#### 5.2.2 `features/dashboard`

Dashboard principal, métricas, visão geral operacional.

```
features/dashboard/
├── components/
│   ├── dashboard-metrics.tsx
│   ├── metric-card.tsx
│   ├── recent-calls-widget.tsx
│   ├── patient-alerts-widget.tsx
│   ├── medication-overview.tsx
│   ├── workforce-snapshot.tsx
│   └── ai-insights-widget.tsx
├── hooks/
│   ├── use-dashboard-data.ts
│   └── use-real-time-metrics.ts
├── types/
│   └── index.ts
├── services/
│   └── dashboard-api.ts
└── index.ts
```

#### 5.2.3 `features/patient-journey`

Jornada do paciente, timeline, visão integrada.

```
features/patient-journey/
├── components/
│   ├── patient-list.tsx
│   ├── patient-detail.tsx
│   ├── patient-header.tsx
│   ├── patient-tabs.tsx
│   ├── patient-timeline.tsx
│   ├── patient-summary-card.tsx
│   ├── admission-form.tsx
│   ├── discharge-form.tsx
│   └── patient-search.tsx
├── hooks/
│   ├── use-patients-query.ts
│   ├── use-patient-detail.ts
│   ├── use-patient-timeline.ts
│   └── use-patient-search.ts
├── schemas/
│   ├── admission-schema.ts
│   ├── discharge-schema.ts
│   └── patient-filter-schema.ts
├── types/
│   └── index.ts
├── services/
│   └── patient-api.ts
├── actions/
│   ├── admit-patient.ts
│   └── discharge-patient.ts
└── index.ts
```

#### 5.2.4 `features/medication`

Prescrição, administração, controle de medicação.

```
features/medication/
├── components/
│   ├── medication-board.tsx
│   ├── prescription-list.tsx
│   ├── prescription-form.tsx
│   ├── administration-form.tsx
│   ├── medication-timeline.tsx
│   ├── overdue-alert.tsx
│   └── medication-schedule.tsx
├── hooks/
│   ├── use-medications-query.ts
│   ├── use-administration-mutation.ts
│   └── use-medication-schedule.ts
├── schemas/
│   ├── prescription-schema.ts
│   └── administration-schema.ts
├── types/
│   └── index.ts
├── services/
│   └── medication-api.ts
├── actions/
│   ├── administer-medication.ts
│   └── skip-medication.ts
└── index.ts
```

#### 5.2.5 `features/calls-and-pain`

Chamadas de paciente, registro e monitoramento de dor.

```
features/calls-and-pain/
├── components/
│   ├── call-board.tsx
│   ├── active-calls-list.tsx
│   ├── call-detail.tsx
│   ├── call-response-form.tsx
│   ├── pain-registry.tsx
│   ├── pain-scale-input.tsx
│   ├── pain-trend-chart.tsx
│   └── call-history.tsx
├── hooks/
│   ├── use-active-calls.ts
│   ├── use-call-response.ts
│   ├── use-pain-records.ts
│   └── use-pain-trends.ts
├── schemas/
│   ├── call-response-schema.ts
│   └── pain-record-schema.ts
├── types/
│   └── index.ts
├── services/
│   ├── call-api.ts
│   └── pain-api.ts
└── index.ts
```

#### 5.2.6 `features/handoff`

Passagem de plantão, handoff estruturado.

```
features/handoff/
├── components/
│   ├── handoff-list.tsx
│   ├── handoff-wizard.tsx
│   ├── handoff-summary.tsx
│   ├── handoff-detail.tsx
│   ├── handoff-review.tsx
│   ├── patient-handoff-card.tsx
│   └── handoff-signature.tsx
├── hooks/
│   ├── use-handoffs-query.ts
│   ├── use-handoff-wizard.ts
│   └── use-handoff-submission.ts
├── schemas/
│   ├── handoff-schema.ts
│   └── handoff-review-schema.ts
├── types/
│   └── index.ts
├── services/
│   └── handoff-api.ts
├── actions/
│   ├── submit-handoff.ts
│   └── approve-handoff.ts
└── index.ts
```

#### 5.2.7 `features/workforce`

Gestão de equipe, escalas, alocação.

```
features/workforce/
├── components/
│   ├── team-overview.tsx
│   ├── schedule-calendar.tsx
│   ├── shift-assignment.tsx
│   ├── team-member-card.tsx
│   ├── workload-chart.tsx
│   └── availability-grid.tsx
├── hooks/
│   ├── use-workforce-query.ts
│   ├── use-schedule.ts
│   └── use-team-members.ts
├── schemas/
│   ├── schedule-schema.ts
│   └── assignment-schema.ts
├── types/
│   └── index.ts
├── services/
│   └── workforce-api.ts
└── index.ts
```

#### 5.2.8 `features/access-control`

Controle de acesso, permissões, RBAC.

```
features/access-control/
├── components/
│   ├── role-manager.tsx
│   ├── permission-matrix.tsx
│   ├── user-role-assignment.tsx
│   ├── access-denied.tsx
│   └── permission-guard.tsx
├── hooks/
│   ├── use-permissions.ts
│   ├── use-roles.ts
│   └── use-access-check.ts
├── types/
│   └── index.ts
├── services/
│   └── access-api.ts
└── index.ts
```

#### 5.2.9 `features/audit`

Auditoria, trilha de ações, compliance.

```
features/audit/
├── components/
│   ├── audit-log-table.tsx
│   ├── audit-detail.tsx
│   ├── audit-filters.tsx
│   ├── audit-export.tsx
│   └── audit-timeline.tsx
├── hooks/
│   ├── use-audit-logs.ts
│   └── use-audit-filters.ts
├── types/
│   └── index.ts
├── services/
│   └── audit-api.ts
└── index.ts
```

#### 5.2.10 `features/observability`

Métricas, logs, traces — visão operacional do sistema.

```
features/observability/
├── components/
│   ├── metrics-dashboard.tsx
│   ├── log-viewer.tsx
│   ├── trace-explorer.tsx
│   ├── alert-manager.tsx
│   ├── health-status-grid.tsx
│   └── performance-chart.tsx
├── hooks/
│   ├── use-metrics.ts
│   ├── use-logs.ts
│   └── use-traces.ts
├── types/
│   └── index.ts
├── services/
│   └── observability-api.ts
└── index.ts
```

#### 5.2.11 `features/admin`

Administração do sistema, configurações.

```
features/admin/
├── components/
│   ├── user-management.tsx
│   ├── user-form.tsx
│   ├── system-settings.tsx
│   ├── integration-status.tsx
│   └── tenant-config.tsx
├── hooks/
│   ├── use-users-query.ts
│   └── use-settings.ts
├── schemas/
│   ├── user-schema.ts
│   └── settings-schema.ts
├── types/
│   └── index.ts
├── services/
│   └── admin-api.ts
└── index.ts
```

#### 5.2.12 `features/agents`

Agentes IA, sugestões, automações assistidas.

```
features/agents/
├── components/
│   ├── agent-list.tsx
│   ├── agent-detail.tsx
│   ├── agent-suggestion-card.tsx
│   ├── agent-history.tsx
│   ├── ai-confidence-indicator.tsx
│   └── human-review-prompt.tsx
├── hooks/
│   ├── use-agents-query.ts
│   ├── use-agent-suggestions.ts
│   └── use-ai-feedback.ts
├── types/
│   └── index.ts
├── services/
│   └── agent-api.ts
└── index.ts
```

#### 5.2.13 `features/command-center`

Centro de comando operacional, visão integrada.

```
features/command-center/
├── components/
│   ├── command-overview.tsx
│   ├── real-time-board.tsx
│   ├── alert-feed.tsx
│   ├── capacity-map.tsx
│   ├── escalation-panel.tsx
│   └── kpi-grid.tsx
├── hooks/
│   ├── use-command-data.ts
│   ├── use-real-time-feed.ts
│   └── use-escalations.ts
├── types/
│   └── index.ts
├── services/
│   └── command-api.ts
└── index.ts
```

---

## 6. Camada `lib/` — Utilitários

```
lib/
├── auth.ts                 # Configuração Auth.js
├── utils.ts                # cn(), formatDate(), formatCurrency()
├── api-client.ts           # Fetch wrapper com auth, retry, logging
├── query-client.ts         # TanStack Query client config
├── constants.ts            # Constantes globais
├── env.ts                  # Tipagem de variáveis de ambiente
└── audit.ts                # Helper de auditoria
```

---

## 7. Camada `hooks/` — Hooks Compartilhados

```
hooks/
├── use-debounce.ts         # Debounce de valor
├── use-media-query.ts      # Responsive breakpoints
├── use-local-storage.ts    # Persistência local
├── use-online-status.ts    # Detecção de rede
├── use-intersection.ts     # Intersection Observer
├── use-clipboard.ts        # Copiar para clipboard
├── use-countdown.ts        # Timer regressivo
├── use-keyboard-shortcut.ts # Atalhos de teclado
├── use-toast.ts            # Toast notifications
└── use-lock-body-scroll.ts # Lock scroll (modals)
```

---

## 8. Camada `types/` — Tipos Globais

```
types/
├── index.ts                # Re-exports
├── api.ts                  # ApiResponse<T>, PaginatedResult<T>, ApiError
├── auth.ts                 # User, Session, Role, Permission
├── common.ts               # ID, Timestamp, Status, SortDirection
├── forms.ts                # FormState, FieldError, ValidationResult
└── env.d.ts                # Tipagem de process.env
```

---

## 9. Camada `schemas/` — Schemas Compartilhados

```
schemas/
├── pagination.ts           # z.object({ page, pageSize, sort, order })
├── date-range.ts           # z.object({ from, to })
├── search.ts               # z.object({ query, filters })
├── file-upload.ts          # z.object({ file, maxSize, types })
└── common.ts               # cpfSchema, phoneSchema, emailSchema, cepSchema
```

---

## 10. Camada `services/` — API Abstraction

```
services/
├── api.ts                  # Base API client (fetch wrapper)
├── patients.ts             # getPatients, getPatient, createPatient, etc.
├── medications.ts          # getMedications, administerMedication, etc.
├── calls.ts                # getCalls, respondCall, etc.
├── handoffs.ts             # getHandoffs, createHandoff, etc.
├── workforce.ts            # getTeams, getSchedule, etc.
├── audit.ts                # getAuditLogs, etc.
├── dashboard.ts            # getDashboardMetrics, etc.
└── agents.ts               # getAgents, getAgentSuggestions, etc.
```

---

## 11. Camada `providers/` — Context Providers

```
providers/
├── query-provider.tsx      # TanStack Query provider
├── theme-provider.tsx      # next-themes provider
├── session-provider.tsx    # Auth.js session provider
├── toast-provider.tsx      # Toast/notification provider
└── degraded-provider.tsx   # Modo degradado context
```

---

## 12. Regras de Importação

### 12.1 Grafo de Dependências

```
app/ ──────────────► features/
  │                     │
  │                     ▼
  ├─────────────► components/
  │                     │
  │                     ▼
  ├──────────────────► hooks/
  │                     │
  ├──────────────────► lib/
  │                     │
  ├──────────────────► types/
  │                     │
  ├──────────────────► schemas/
  │                     │
  ├──────────────────► services/
  │                     │
  └──────────────────► providers/
```

### 12.2 Regras Estrictas

1. **`features/X` NÃO importa de `features/Y`** — se precisa compartilhar, move para `components/` ou `hooks/`
2. **`components/` NÃO importa de `features/`** — componentes são genéricos
3. **`app/` importa de `features/` e `components/`** — orquestra a composição
4. **`lib/` é puro** — sem imports de React ou componentes
5. **`types/` e `schemas/` são folhas** — não importam de outras camadas

### 12.3 Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/features/*": ["./src/features/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"],
      "@/schemas/*": ["./src/schemas/*"],
      "@/services/*": ["./src/services/*"],
      "@/providers/*": ["./src/providers/*"],
      "@/config/*": ["./src/config/*"]
    }
  }
}
```

---

## 13. Convenções de Nomenclatura

### 13.1 Arquivos

| Tipo             | Convenção                   | Exemplo                         |
| ---------------- | --------------------------- | ------------------------------- |
| Componente React | kebab-case                  | `patient-list.tsx`              |
| Hook             | kebab-case com `use-`       | `use-patients-query.ts`         |
| Schema Zod       | kebab-case com `-schema`    | `admission-schema.ts`           |
| Tipo/Interface   | kebab-case                  | `index.ts` (dentro de `types/`) |
| Utilitário       | kebab-case                  | `formatters.ts`                 |
| Server Action    | kebab-case com verbo        | `admit-patient.ts`              |
| Constante        | kebab-case                  | `routes.ts`                     |
| Teste            | `*.test.ts` ou `*.test.tsx` | `patient-list.test.tsx`         |

### 13.2 Exports

| Tipo       | Convenção              | Exemplo                                        |
| ---------- | ---------------------- | ---------------------------------------------- |
| Componente | PascalCase             | `export function PatientList()`                |
| Hook       | camelCase com `use`    | `export function usePatientsQuery()`           |
| Schema     | camelCase com `Schema` | `export const admissionSchema = z.object(...)` |
| Tipo       | PascalCase             | `export interface Patient { ... }`             |
| Constante  | UPPER_SNAKE_CASE       | `export const MAX_PATIENTS_PER_PAGE = 50`      |
| Utilitário | camelCase              | `export function formatDate()`                 |

---

## 14. Criação de Nova Feature — Checklist

Ao criar um novo domínio:

- [ ] Criar pasta em `features/<nome>/`
- [ ] Criar subpastas: `components/`, `hooks/`, `types/`, `services/`
- [ ] Criar `index.ts` com barrel exports
- [ ] Criar rotas em `app/(platform)/<nome>/`
- [ ] Adicionar `loading.tsx` e `error.tsx` na rota
- [ ] Registrar na sidebar (`components/layout/sidebar.tsx`)
- [ ] Adicionar permissão em `config/permissions.ts`
- [ ] Documentar no README do domínio (se complexo)

---

## 15. Referências

- [Next.js Project Structure](https://nextjs.org/docs/getting-started/project-structure)
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [Feature-Sliced Design](https://feature-sliced.design)
