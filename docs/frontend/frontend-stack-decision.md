# ADR-001: Stack Frontend — Velya Platform

**Status:** Aceito
**Data:** 2026-04-09
**Autores:** Equipe de Engenharia Velya
**Contexto:** Plataforma hospitalar de jornada do paciente com requisitos de alta disponibilidade, conformidade regulatória, e operação mobile-first por equipes clínicas.

---

## 1. Resumo Executivo

Este documento registra a decisão arquitetural (ADR) para o stack frontend da plataforma Velya. A decisão abrange framework, linguagem, roteamento, estilização, sistema de componentes, gerenciamento de estado de servidor, tabelas, formulários, validação, autenticação e visualização de dados.

### Stack Selecionado

| Camada | Tecnologia | Versão Mínima |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Linguagem | TypeScript | 5.7+ |
| UI Base | React | 19.x |
| Estilização | Tailwind CSS | 4.x |
| Componentes | shadcn/ui | latest |
| Estado Servidor | TanStack Query | 5.x |
| Tabelas | TanStack Table | 8.x |
| Virtualização | TanStack Virtual | 3.x |
| Formulários | React Hook Form | 7.x |
| Validação | Zod | 3.x |
| Autenticação | Auth.js (next-auth v5) | 5.x beta |
| Gráficos | Recharts | 2.x |

---

## 2. Contexto e Motivação

### 2.1 Requisitos do Domínio Hospitalar

A plataforma Velya opera em ambiente hospitalar com as seguintes características críticas:

- **Operação 24/7**: Enfermeiros, médicos e equipe assistencial acessam o sistema continuamente
- **Dispositivos heterogêneos**: Desktops em postos de enfermagem, tablets em rounds, smartphones pessoais
- **Rede instável**: Wi-Fi hospitalar com zonas de cobertura irregular, elevadores, subsolos
- **Ações críticas**: Registro de medicação, escalas de dor, handoffs que impactam diretamente o paciente
- **Conformidade**: LGPD, HIPAA-like, rastreabilidade de ações, auditoria completa
- **Múltiplos perfis**: Desde administradores até técnicos de enfermagem com letramento digital variado

### 2.2 Requisitos Técnicos Derivados

1. **Performance mobile**: LCP < 2.5s em 4G, FID < 100ms
2. **Operação degradada**: Feedback explícito quando rede falha, nunca falha silenciosa
3. **Acessibilidade**: WCAG 2.1 AA mínimo
4. **Auditabilidade**: Toda ação sensível rastreável até o operador
5. **Escalabilidade de desenvolvimento**: Equipe distribuída, features independentes
6. **Type safety end-to-end**: Contratos tipados do backend ao componente

---

## 3. Decisões Detalhadas

### 3.1 Next.js com App Router

**Decisão:** Next.js 15+ com App Router como framework principal.

**Justificativa:**

- **Server Components por padrão**: Reduz JavaScript enviado ao cliente, crítico para dispositivos móveis hospitalares
- **Streaming e Suspense**: Carregamento progressivo de dashboards complexos
- **Route handlers**: API routes para BFF (Backend for Frontend) sem servidor separado
- **Middleware nativo**: Proteção de rotas, redirecionamentos, verificação de sessão no edge
- **Image optimization**: Compressão automática, formatos modernos (WebP/AVIF)
- **Partial Prerendering**: Combina estático e dinâmico na mesma página

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| Remix | Ecossistema menor, menos integrações enterprise, comunidade hospitalar inexistente |
| Vite + React SPA | Sem SSR nativo, SEO não aplicável mas perda de Server Components e streaming |
| Angular | Curva de aprendizado alta, bundle size maior, menos adequado para composição de componentes |
| Astro | Foco em conteúdo estático, não adequado para aplicações interativas complexas |
| SvelteKit | Ecossistema menor, menos bibliotecas enterprise, risco de contratação |

### 3.2 TypeScript Strict

**Decisão:** TypeScript 5.7+ com configuração strict habilitada.

**Justificativa:**

- **Segurança de tipos em domínio crítico**: Erros de tipo em dados de medicação ou paciente são inaceitáveis
- **Contratos explícitos**: Interfaces compartilhadas entre frontend e backend via packages
- **Refactoring seguro**: Base de código hospitalar evolui com frequência regulatória
- **Developer experience**: Autocomplete, documentação inline, navegação de código
- **Validação em tempo de compilação**: Captura erros antes do deploy

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| JavaScript puro | Sem segurança de tipos, inaceitável em domínio hospitalar |
| Flow | Ecossistema em declínio, tooling inferior |
| ReScript | Comunidade pequena, curva de aprendizado, interop com React limitado |

### 3.3 Tailwind CSS

**Decisão:** Tailwind CSS 4.x como sistema de estilização primário.

**Justificativa:**

- **Utility-first**: Composição rápida, sem conflitos de CSS, purge automático
- **Design tokens via CSS variables**: Temas semânticos (hospitalar dark/light)
- **Responsividade declarativa**: Classes `sm:`, `md:`, `lg:` para breakpoints hospitalares
- **Performance**: CSS mínimo em produção, sem runtime
- **Integração shadcn/ui**: Base nativa do sistema de componentes escolhido
- **Container queries**: Suporte nativo para componentes adaptativos

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| CSS Modules | Mais verboso, sem tokens centralizados, integração manual com design system |
| Styled Components | Runtime JS, performance inferior em mobile, Server Components incompatível |
| Emotion | Mesmos problemas de runtime que Styled Components |
| Vanilla Extract | Build-time mas verboso, ecossistema menor |
| Panda CSS | Promissor mas ecossistema imaturo para produção hospitalar |

### 3.4 shadcn/ui

**Decisão:** shadcn/ui como base do design system.

**Justificativa:**

- **Copy-paste, não dependência**: Componentes no repositório, controle total do código
- **Radix UI primitives**: Acessibilidade nativa (ARIA, keyboard nav, screen readers)
- **Tailwind nativo**: Integração perfeita com o sistema de estilização
- **Customização ilimitada**: Tokens hospitalares aplicados diretamente nos componentes
- **Sem lock-in**: Componentes são código próprio, não biblioteca externa
- **CVA (Class Variance Authority)**: Variantes tipadas e composição de estilos

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| MUI (Material UI) | Bundle grande, estilização via Emotion (runtime), design Google não hospitalar |
| Ant Design | Design chinês, customização complexa, bundle pesado |
| Chakra UI | Runtime CSS-in-JS, performance mobile inferior |
| Mantine | Bom mas menos flexível que código próprio sobre Radix |
| Headless UI | Menos componentes que Radix, sem variantes |

### 3.5 TanStack Query (React Query)

**Decisão:** TanStack Query v5 para gerenciamento de estado de servidor.

**Justificativa:**

- **Cache inteligente**: Dados hospitalares cacheados com invalidação precisa
- **Stale-while-revalidate**: Dashboard mostra dados anteriores enquanto atualiza
- **Retry automático**: Resiliente a falhas de rede hospitalar
- **Optimistic updates**: Feedback instantâneo em ações de enfermagem
- **Devtools**: Debug de queries em desenvolvimento
- **Mutations com rollback**: Segurança em ações de medicação
- **Prefetching**: Pré-carrega dados da próxima tela provável
- **Background refetch**: Dados sempre atualizados sem refresh manual

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| SWR | Menos features (sem mutations robustas, sem devtools completos) |
| Redux Toolkit Query | Verboso, boilerplate excessivo, Redux desnecessário |
| Apollo Client | GraphQL-only, backend Velya é REST/gRPC |
| Zustand + fetch manual | Reinvenção da roda, sem cache/retry/invalidation nativos |

### 3.6 TanStack Table

**Decisão:** TanStack Table v8 para todas as tabelas de dados.

**Justificativa:**

- **Headless**: Controle total do markup e estilização
- **Type-safe**: Colunas tipadas com dados do domínio hospitalar
- **Features nativas**: Sorting, filtering, pagination, grouping, expansion
- **Virtualização via TanStack Virtual**: Tabelas com milhares de linhas (logs, auditoria)
- **Column visibility**: Usuário escolhe colunas relevantes para seu papel
- **Row selection**: Ações em lote (aprovar múltiplas prescrições)

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| AG Grid | Licença cara, overhead para o uso hospitalar |
| React Table (v7) | Deprecated em favor do TanStack Table |
| Tabelas HTML manuais | Sem features, manutenção insustentável |
| DataGrid MUI | Acoplado ao MUI, licença premium para features avançadas |

### 3.7 React Hook Form + Zod

**Decisão:** React Hook Form para gerenciamento de formulários, Zod para validação.

**Justificativa React Hook Form:**

- **Performance**: Renderizações mínimas via refs, crítico em formulários grandes (admissão)
- **Uncontrolled by default**: Menos re-renders que alternativas
- **DevTools**: Debug de estado do formulário
- **Watch seletivo**: Observa apenas campos necessários
- **Integration nativa com Zod** via `@hookform/resolvers`

**Justificativa Zod:**

- **TypeScript-first**: Schema = tipo, sem duplicação
- **Composição**: Schemas reutilizáveis entre frontend e backend
- **Validação runtime**: Segurança além do TypeScript
- **Mensagens customizadas**: Erros em português para equipe hospitalar
- **Transform e refine**: Transformação e validação assíncrona (ex: verificar CPF)

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| Formik | Performance inferior, mais re-renders |
| React Final Form | Mantido por uma pessoa, risco de abandono |
| Yup | Menos type-safe que Zod, API menos elegante |
| io-ts | Mais funcional, curva de aprendizado alta |
| Valibot | Promissor mas ecossistema menor |

### 3.8 Auth.js (next-auth v5)

**Decisão:** Auth.js v5 (next-auth beta) para autenticação e sessão.

**Justificativa:**

- **Next.js nativo**: Integração App Router, middleware, Server Components
- **Session strategies**: JWT e database sessions conforme necessidade
- **Providers flexíveis**: Credentials para login hospitalar, OAuth para SSO futuro
- **RBAC ready**: Claims e roles customizáveis para hierarquia hospitalar
- **Edge compatible**: Verificação de sessão no middleware sem cold start
- **Callbacks tipados**: TypeScript em todo o fluxo de autenticação

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| Clerk | SaaS externo, dados de autenticação fora do controle hospitalar |
| Auth0 | Vendor lock-in, custo em escala, latência externa |
| Supabase Auth | Acoplado ao Supabase, não aplicável |
| Implementação manual JWT | Reinvenção da roda, superfície de ataque maior |
| Keycloak | Server-side only, complexidade de deploy, UI padrão inadequada |

### 3.9 Recharts

**Decisão:** Recharts 2.x para visualização de dados.

**Justificativa:**

- **React nativo**: Componentes declarativos, composição natural
- **SVG-based**: Renderização nítida em qualquer resolução
- **Responsivo**: Container-based sizing, adapta a mobile
- **Tipos de chart**: Line, Bar, Area, Pie, Radar — cobre dashboards hospitalares
- **Customização**: Tooltips, legends, axes customizáveis
- **Animações opcionais**: Desabilitáveis para performance ou acessibilidade
- **Bundle moderado**: ~45kb gzipped, aceitável para o uso

**Alternativas descartadas:**

| Alternativa | Motivo da Rejeição |
|---|---|
| D3.js | Imperativo, curva alta, sem componentes React |
| Chart.js (react-chartjs-2) | Canvas-based, menos nítido, interação limitada |
| Nivo | Bom mas bundle maior, API mais complexa |
| Victory | Menos mantido, API verbosa |
| Visx | Muito baixo nível, precisa construir tudo |
| Tremor | Opinionated demais, menos flexível |

---

## 4. Princípios de Integração

### 4.1 Composição do Stack

```
Auth.js (sessão/autenticação)
  └── Next.js App Router (framework)
       ├── Server Components (dados estáticos, layouts)
       ├── Client Components (interação)
       │    ├── TanStack Query (estado servidor)
       │    ├── React Hook Form + Zod (formulários)
       │    ├── TanStack Table + Virtual (tabelas)
       │    └── Recharts (gráficos)
       └── shadcn/ui + Tailwind (UI primitives)
```

### 4.2 Fluxo de Dados Típico

1. **Auth.js** verifica sessão no middleware
2. **Server Component** pré-carrega dados via fetch
3. **TanStack Query** hidrata cache no cliente
4. **shadcn/ui** renderiza interface com dados
5. **React Hook Form** captura input do usuário
6. **Zod** valida antes do envio
7. **TanStack Query mutation** envia ao backend
8. **Cache invalidation** atualiza a UI

### 4.3 Compartilhamento de Tipos

```
packages/
  schemas/        # Zod schemas compartilhados
  types/          # TypeScript types derivados dos schemas
  ui/             # Componentes shadcn/ui compartilhados
```

---

## 5. Riscos e Mitigações

### 5.1 Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Auth.js v5 em beta | Média | Alto | Abstração sobre Auth.js, possível troca por implementação própria |
| TanStack Table complexidade | Baixa | Médio | Wrapper padronizado (`<DataTable />`) com defaults hospitalares |
| Tailwind verbosidade | Baixa | Baixo | CVA + componentes shadcn/ui encapsulam classes |
| Next.js breaking changes | Baixa | Médio | Canary testing, upgrade gradual, testes E2E |
| Bundle size mobile | Média | Alto | Tree-shaking, lazy loading, performance budgets por rota |

### 5.2 Decisões Reversíveis

- **Recharts**: Substituível por outra lib de charts sem impacto estrutural
- **shadcn/ui components individuais**: Cada componente é código próprio, substituível
- **Auth.js**: Abstração permite trocar provider de autenticação

### 5.3 Decisões Difíceis de Reverter

- **Next.js App Router**: Framework é fundacional, troca é rewrite
- **TypeScript**: Remover tipagem é impraticável e indesejável
- **TanStack Query como estado servidor**: Padrão permeia toda a aplicação

---

## 6. Critérios de Sucesso

| Métrica | Target |
|---|---|
| LCP mobile 4G | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Bundle JS por rota (gzipped) | < 150kb |
| Cobertura de testes (linhas) | > 80% |
| Acessibilidade (Lighthouse) | > 90 |
| Build time | < 3 min |
| Tempo para primeira interação (mobile) | < 4s |

---

## 7. Referências

- [Next.js App Router](https://nextjs.org/docs/app)
- [TanStack Query](https://tanstack.com/query)
- [TanStack Table](https://tanstack.com/table)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Auth.js](https://authjs.dev)
- [Recharts](https://recharts.org)
- [Tailwind CSS](https://tailwindcss.com)

---

## 8. Histórico de Revisões

| Data | Versão | Alteração |
|---|---|---|
| 2026-04-09 | 1.0 | Decisão inicial documentada |
