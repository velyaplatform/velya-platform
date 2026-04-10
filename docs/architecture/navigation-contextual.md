# Arquitetura de Navegação Contextual Integrada

> Owner: Plataforma Web Office. Status: ativo a partir de 2026-04-10.
>
> Documento canônico de navegação da Velya. Toda tela do aplicativo web
> deve cumprir as diretrizes aqui descritas. Revisões semestrais pelo
> Plataforma Web Office. Alterações estruturais exigem ADR em
> `docs/architecture/decisions/`.

---

## 1. Visão executiva

Sistemas hospitalares tradicionais são notoriamente fragmentados. Uma enfermeira
que precisa iniciar uma dieta enteral para um paciente pode ter que abrir quatro
sistemas distintos — o prontuário, o sistema de prescrição, o módulo de nutrição
e o controle de leitos — e ainda assim perder o contexto do paciente entre uma
tela e outra. O resultado é perda de tempo, retrabalho, cansaço cognitivo,
erros clínicos e, principalmente, incapacidade de enxergar a história completa
do paciente como um todo vivo. Na Velya, reconhecemos a fragmentação como o
inimigo número um da experiência clínica. Todo botão, todo link, todo
breadcrumb e toda URL que projetamos carrega a missão de reduzir esse atrito.

A resposta arquitetural da Velya é uma abordagem que chamamos de
**navegação contextual integrada**: uma malha de relações explícitas entre
entidades, complementada por mecanismos agressivos de encontrabilidade
(busca global, busca contextual, filtros, recentes, favoritos) e por
governança de informação (taxonomias, auditoria, papéis, breadcrumbs,
hierarquia). Cada registro conhece as entidades a que está relacionado.
Cada tela sabe de onde o usuário veio e para onde pode ir. Cada URL é
compartilhável, linkável e reproduzível. Cada clique deixa um rastro
auditável. Essa combinação de relacionamentos, encontrabilidade e
governança é o que permite que a interface de 23 módulos clínico-operacionais
pareça um único organismo coerente.

Hoje, a Velya já implementa a maior parte dessa arquitetura. A sidebar
`<Navigation>` (ver `apps/web/src/app/components/navigation.tsx`) é agrupada
em três seções por papel. O `<AppShell>` (`apps/web/src/app/components/app-shell.tsx`)
exibe alertas críticos, relógio, Patient Quick Switcher e avatar clicável.
O `<CommandPalette>` (`apps/web/src/app/components/command-palette.tsx`)
oferece busca global por atalho de teclado. O `<ModuleListView>`
(`apps/web/src/app/components/module-list-view.tsx`) cobre 23 módulos com
filtros, sort, paginação, busca interna, export CSV e breadcrumbs básicos.
O `module-manifest.ts` (`apps/web/src/lib/module-manifest.ts`) centraliza
rota, recurso FHIR, classe de dado, papéis autorizados, colunas e filtros
de cada módulo — eliminando código duplicado e servindo como fonte única
da verdade para o menu, para breadcrumbs, para a API `/api/entities/[moduleId]`
e para a tela de edição genérica. Este documento descreve o estado atual
e define o backlog para completar a navegação contextual como desejado.

---

## 2. Princípios obrigatórios

Estes 15 princípios são inegociáveis e devem ser verificados em todo PR
que adicione ou modifique componentes de interface.

1. **Consistência**. Dois módulos que oferecem operações equivalentes devem
   apresentar exatamente os mesmos padrões visuais, atalhos de teclado,
   posicionamento de botões, títulos e breadcrumbs. A padronização é
   garantida pelo `<ModuleListView>` compartilhado.
2. **Clareza semântica**. Todo rótulo é escrito em português brasileiro,
   formal e curto. Nada de jargão interno desnecessário. Nada de emoji
   substituindo texto (os emojis dos ícones de módulo são complementares,
   não substitutivos).
3. **Agrupamento por tarefa**. Itens relacionados à mesma tarefa clínica
   aparecem juntos no menu. Ex.: Prescrições, Ordens de Lab, Imagem, NEWS2
   e Alertas estão todos em ASSISTENCIAL, não espalhados entre seções.
4. **Hierarquia visual**. Títulos, subtítulos, breadcrumbs, badges e botões
   têm pesos e cores tipográficas distintos. O foco da atenção é sempre
   o conteúdo central; ações vivem na periferia.
5. **Previsibilidade**. O botão "Voltar" sempre leva ao local de onde o
   usuário veio, preservando filtros, paginação e busca. O clique em uma
   linha de lista sempre abre o detail. O atalho `⌘K` sempre abre o
   Command Palette. A interface não surpreende.
6. **Progressão natural**. Tarefas longas (ex.: passagem de plantão via
   I-PASS em `/handoffs/new`) apresentam passos numerados, progresso
   visível e a possibilidade de voltar sem perder dados.
7. **Proximidade conteúdo-ação**. A ação relevante para um registro está
   ao lado do registro — não no final de uma longa barra superior. Botões
   "Editar", "Arquivar" e "Link para paciente" aparecem dentro do card
   ou na linha, não em uma toolbar remota.
8. **Redução de esforço cognitivo**. A tela não pede ao usuário para
   memorizar nada. Se uma tela precisa do MRN de um paciente, ela mostra
   o nome junto. Se uma tela tem contexto, o breadcrumb mostra a cadeia.
9. **Manutenção do contexto**. Clicar em um link nunca descarta o estado
   anterior. Filtros sobrevivem a voltar. Um paciente aberto no quick
   switcher permanece como recente em todas as abas.
10. **Foco em tarefa principal**. Cada tela tem uma tarefa primária
    explícita no título. Ações secundárias são visualmente rebaixadas.
11. **Acessibilidade WCAG 2.2 AA**. Contraste mínimo 4.5:1, foco visível,
    navegação completa por teclado, atributos `aria-*` obrigatórios,
    `aria-live` para listas que recarregam, labels em toda entrada de
    formulário, tamanho mínimo de toque de 44x44px em mobile.
12. **Mobile + desktop**. Toda tela funciona em viewports de 360px de
    largura. A sidebar vira drawer. Linhas de tabela viram cards.
    Nenhum fluxo crítico é inacessível em celular.
13. **Baixa curva**. Um profissional novo precisa realizar a tarefa mais
    frequente do seu papel em menos de 5 minutos após o primeiro login.
14. **Produtividade frequente**. Usuários recorrentes (médicos, enfermeiros,
    farmacêuticos) têm atalhos de teclado para as ações mais comuns.
    O `<ShortcutsHelp>` documenta todos os atalhos.
15. **Descoberta**. Todo recurso novo deve ser encontrável via Command
    Palette, busca contextual ou categoria de navegação. Não há recursos
    ocultos acessíveis somente por URL sabida.

---

## 3. Modelo de navegação em camadas

A Velya trabalha com cinco camadas de navegação. Cada uma tem um
propósito, um componente correspondente e regras próprias.

### 3.1 Navegação global

É a camada que se aplica a todo o aplicativo, independentemente da
tela em que o usuário esteja.

**Sidebar — `<Navigation>`**
- Arquivo: `apps/web/src/app/components/navigation.tsx`
- Agrupa os itens em três seções: `ASSISTENCIAL`, `GESTAO`,
  `ADMINISTRACAO`. Uma quarta seção `OBSERVABILIDADE` existe no enum
  `NAV_SECTIONS` para futura expansão.
- Cada item é descrito pela interface `NavItemDef { href, icon, label,
  badge?, section, requiredAction? }`.
- Filtragem por papel é feita no cliente por `getNavigationSections()`
  de `apps/web/src/lib/access-control.ts`, que recebe a role
  profissional resolvida (`resolveUiRole`) e devolve só as seções a
  que o usuário tem direito.
- Em mobile, a sidebar vira um drawer controlado por
  `sidebarOpen` no `<AppShell>`, abrível pelo hamburguer do topbar.
- Itens inativos recebem `aria-current="page"` quando o pathname casa.

**Topbar — `<AppShell>`**
- Arquivo: `apps/web/src/app/components/app-shell.tsx`
- Oferece quatro acessos rápidos à direita:
  1. **Alertas Críticos** — botão com badge vermelho, navega para `/alerts`.
  2. **Patient Quick Switcher** — ver `<PatientQuickSwitcher>`.
  3. **Relógio** — atualiza a cada segundo, apoiando registros com horário.
  4. **Avatar clicável** — navega para `/me`, o painel pessoal, mostrando
     nome, conselho profissional, nível de acesso e indicador visual de
     sessão ativa.
- À esquerda: título da página atual (`pageTitle` via prop).
- O `<AppShell>` é quem chama `/api/auth/session` e redireciona para
  `/login` se a sessão não existir, servindo como porteiro da aplicação.

### 3.2 Navegação local

É a camada dentro de uma tela que o usuário usa para organizar conteúdo
sem sair do contexto. Tabs, filtros, buscas locais, chips.

- **Tabs internos**. Ex.: `/handoffs` tem tabs "Recebidas" e "Enviadas";
  `/delegations` o mesmo; `/me` apresenta três colunas de atividade
  pessoal (tarefas, notificações, histórico). As tabs vivem dentro do
  card da página e não afetam a URL (exceto quando explicitamente
  marcadas como sub-rotas).
- **Filtros do `<ModuleListView>`**. Arquivo:
  `apps/web/src/app/components/module-list-view.tsx`. Cada módulo
  declara seu array `filters[]` no manifest; o componente renderiza
  dropdowns para `type: 'select'` (com opções explícitas ou extraídas
  automaticamente dos dados) e campos de busca para `type: 'search'`.
- **Busca interna**. O `<ModuleListView>` oferece um `<input type="search">`
  que filtra todas as colunas stringificáveis via `toString()`
  case-insensitive. Não há debounce (o dataset é pequeno, até 2000 linhas);
  para listas maiores, usar o hook `use-debounced-value.ts`.
- **Sort e paginação**. Cada coluna pode ser ordenada clicando no header.
  A paginação é fixa em 25/50/100 linhas por página, controlada pelo
  próprio componente via state local (não persiste na URL hoje — ver
  seção 11 sobre URL como fonte de verdade).
- **Export CSV**. Botão no cabeçalho do `<ModuleListView>` exporta
  exatamente o que está filtrado e ordenado. Não exporta dados
  sensíveis mascarados.

### 3.3 Navegação contextual

É a camada que conecta o registro que o usuário está vendo a outras
entidades relacionadas, sem exigir uma busca explícita. É o coração
da promessa "navegação contextual".

**Exemplos reais já implementados:**

- **Edit page com histórico auditado**. Em
  `apps/web/src/app/edit/[moduleId]/[recordId]/page.tsx`, a tela de
  edição genérica apresenta uma sidebar direita com a timeline de
  mudanças daquele registro, com ator, timestamp, campo alterado e
  valores anterior/atual, vinda do hash-chained `audit-logger.ts`.
  É contexto puro — o usuário vê o que mudou sem sair do registro.
- **Página de especialidade com relacionamentos**. Em
  `apps/web/src/app/specialties/[id]/page.tsx`, a página de detalhe
  da especialidade mostra duas seções contextuais: "Funcionários
  envolvidos" (médicos e enfermeiros vinculados) e "Alas onde atua"
  (setores onde a especialidade é exercida). Cada item é linkável
  para o respectivo detail.
- **`/me` com pacientes atribuídos**. A tela de perfil pessoal mostra,
  além de tarefas e atividade, os pacientes atualmente atribuídos ao
  profissional logado — com link direto para o detail do paciente.
- **Alergy Alert contextual**. O componente `<AllergyAlert>`
  (`apps/web/src/app/components/allergy-alert.tsx`) aparece em prescrição
  de medicamentos cruzando a alergia conhecida do paciente com o
  ingrediente prescrito — contexto aplicado à ação.

**Proposta: `<RelatedItems>`**
- Um componente genérico a ser criado em
  `apps/web/src/app/components/related-items.tsx` que aceita
  `entityType` e `entityId`, chama `/api/related/[type]/[id]` e
  renderiza um card com os principais relacionamentos daquela entidade,
  agrupados por tipo. Deve substituir o código ad-hoc das páginas
  existentes (specialties, me) e servir como padrão para todas as
  futuras telas de detalhe.

### 3.4 Navegação relacional

É a camada que representa explicitamente o grafo entidade-entidade,
permitindo pular de um registro a outro pelo relacionamento que os
une. É um superconjunto da contextual: além de mostrar, permite
navegar.

- **Coluna `linkTo` em `ColumnDef`**. Exemplo real do manifest:
  ```ts
  { key: 'patientMrn', label: 'Paciente', linkTo: '/patients/${row.patientMrn}' }
  ```
  O `<ModuleListView>` interpreta a string como template, substitui
  `${row.X}` pelo valor do campo `X` daquela linha e renderiza como
  `<Link>`. Presente em 14 dos 23 módulos hoje.
- **API proposta `/api/related/[type]/[id]`**. Devolverá um grafo
  abreviado em JSON:
  ```json
  {
    "entity": { "type": "patient", "id": "MRN-013" },
    "relations": {
      "prescriptions": [{ "id": "RX-4523", "medication": "amoxicilina" }],
      "lab_orders":    [{ "id": "LAB-991",  "testName": "hemograma" }],
      "audit_events":  [{ "id": "AE-7112",  "action": "view" }]
    }
  }
  ```
  O payload é derivado do `entity-resolver.ts` do backend (que já tem
  um `FIXTURE_REGISTRY` com o shape de cada entidade).
- **Comparação entre duas entidades (proposto)**. Rota
  `/compare/[type]?a=ID-1&b=ID-2` que abre uma visão lado a lado de
  duas entidades do mesmo tipo. Útil para comparar dois pacientes,
  dois protocolos de ala, duas cotações de fornecedor.

### 3.5 Navegação de retorno e continuidade

É a camada que preserva o estado do usuário através do tempo e dos
refreshes. Sem ela, toda navegação vira um reset.

- **Breadcrumbs derivados do manifest**. O `<ModuleListView>` já
  renderiza um breadcrumb básico no topo (Categoria → Módulo). A
  **proposta** é extrair isso para um componente isolado
  `<Breadcrumbs>` em `apps/web/src/app/components/breadcrumbs.tsx`
  que aceita uma rota, consulta o manifest, e devolve a cadeia
  Categoria → Módulo → Registro. Ver seção 15.
- **Botão "← Voltar"**. Toda tela de detalhe e de edição apresenta
  um botão de voltar no canto superior esquerdo do conteúdo
  principal. Ele usa `router.back()` quando há histórico, e um
  href padrão quando o usuário entrou por URL direta (ex.: veio
  de um link compartilhado).
- **Filter persistence em URL (proposto)**. Ver seção 11. Hoje os
  filtros do `<ModuleListView>` vivem em state local, o que implica
  que um refresh reseta a visão. A proposta é mover para
  `useSearchParams()` + `router.replace()`, para que a URL se torne
  a fonte da verdade e seja compartilhável.
- **Recents via `recent-patients.ts`**. Arquivo:
  `apps/web/src/app/components/recent-patients.ts`. Uma lista de
  até 10 MRNs em `localStorage` (chave `velya:recent-patients`),
  com `safeRead()`/`safeWrite()`, dedup por MRN (move o repetido
  para o topo), um evento customizado `velya:recent-patients-changed`
  para sincronizar componentes, e cross-tab sync via listener de
  `storage` event. O hook `useRecentPatients()` assina.
- **`<PatientQuickSwitcher>` no topbar**. Arquivo:
  `apps/web/src/app/components/patient-quick-switcher.tsx`. Um
  dropdown acessível por clique (e teclado) que exibe os recents,
  permite ir direto ao detail do paciente e limpar a lista.

---

## 4. Arquitetura da informação

Toda navegação se apoia em uma arquitetura de informação clara. A Velya
usa três eixos de organização: **entidade**, **categoria** e
**taxonomia de sensibilidade**.

### Entidades centrais

São 23 módulos, registrados em `apps/web/src/lib/module-manifest.ts`,
distribuídos em 9 categorias:

| Categoria | Módulos |
|---|---|
| `clinical` | prescriptions |
| `diagnostics` | lab-orders, lab-results, imaging-orders, imaging-results |
| `pharmacy` | pharmacy-stock |
| `operations` | cleaning-tasks, transport-orders, meal-orders |
| `supply-chain` | supply-items, purchase-orders |
| `facility` | assets, work-orders, waste-manifests |
| `billing` | charges, claims, denials |
| `governance` | incidents, audit-events, credentials, consent-forms |
| `master-data` | medical-specialties, hospital-wards |

As entidades-satélite não-modulares mas centrais para a navegação são:
`patients`, `employees`, `suppliers`, `tasks`, `beds`, `alerts`,
`handoffs` e `delegations`. Elas têm páginas próprias em
`apps/web/src/app/` mas não usam o `<ModuleListView>` genérico
(têm experiências especializadas).

### Taxonomia de sensibilidade (data class A–E)

Definida em `apps/web/src/lib/access-control.ts`. Cada módulo declara
uma `dataClass`:

| Classe | Nome | Exemplo | Regras típicas |
|---|---|---|---|
| **A** | Operacional | `pharmacy-stock`, `assets` | Acesso amplo, audit leve |
| **B** | Administrativo | `charges`, `audit-events` | Audit full, role-restricted |
| **C** | Contextual clínico | `meal-orders` | Papéis clínicos + audit full |
| **D** | Sensível clínico | `prescriptions`, `lab-results`, `incidents` | Audit full, PHI mask, break-glass |
| **E** | Altamente restrito | (reservado) | Consent explícito por acesso |

Essa classificação define quem vê, quem edita, quem é auditado e como
os dados aparecem na navegação: entidades classe D/E exibem indicadores
visuais de sensibilidade e não aparecem em recentes de usuários sem
papel clínico.

### Tags e metadados navegáveis

O manifest oferece três metadados que podem virar facetas de navegação:

- `fhirResource` — mapeamento FHIR R4 (ex.: `MedicationRequest`,
  `ServiceRequest (category=laboratory)`). Permite perguntas como
  "me mostre todos os módulos que lidam com `Task`".
- `regulatoryBasis` — array de normas brasileiras aplicáveis
  (ex.: `ANVISA RDC 222/2018`, `CFM Res. 2217/2018`, `LGPD Art. 37`).
  Permite filtro do tipo "todas as telas que cumprem a LGPD".
- `allowedRoles` + `editorRoles` — permite filtrar por papel
  profissional de forma programática.

---

## 5. Modelo de entidades conectadas

A matriz abaixo descreve, para cada um dos 23 módulos + entidades
satélite, com quais outras entidades ele se conecta. É essa matriz
que alimentará o `<RelatedItems>` e a API `/api/related/[type]/[id]`.

| Entidade | Relações explícitas |
|---|---|
| `prescriptions` | patients, pharmacy-stock, charges, audit-events, employees (prescriber) |
| `lab-orders` | patients, lab-results, charges, audit-events, employees (requester) |
| `lab-results` | patients, lab-orders, alerts (critical), audit-events |
| `imaging-orders` | patients, imaging-results, charges, audit-events |
| `imaging-results` | patients, imaging-orders, audit-events, employees (reporter) |
| `pharmacy-stock` | prescriptions, supply-items, purchase-orders, audit-events |
| `cleaning-tasks` | hospital-wards, employees (assignee), beds, audit-events |
| `transport-orders` | patients, hospital-wards (origin/destination), employees, audit-events |
| `meal-orders` | patients, incidents (se alergia disparou), audit-events |
| `supply-items` | pharmacy-stock, purchase-orders, suppliers, assets, audit-events |
| `purchase-orders` | suppliers, supply-items, charges, audit-events |
| `assets` | work-orders, suppliers, supply-items, hospital-wards, audit-events |
| `work-orders` | assets, employees (assignee), incidents, audit-events |
| `waste-manifests` | hospital-wards, employees, audit-events |
| `charges` | patients, claims, denials, prescriptions, lab-orders, imaging-orders |
| `claims` | patients, charges, denials, audit-events |
| `denials` | claims, charges, audit-events |
| `incidents` | patients, employees, hospital-wards, assets, work-orders, audit-events |
| `audit-events` | qualquer entidade (campos `resourceType` + `patientMrn` + `actor`) |
| `credentials` | employees, audit-events |
| `consent-forms` | patients, audit-events |
| `medical-specialties` | employees (practitioners), hospital-wards |
| `hospital-wards` | beds, cleaning-tasks, employees (assigned), incidents |
| `patients` | TODOS os módulos clínicos, recents, consent-forms, handoffs |
| `employees` | credentials, delegations, handoffs, medical-specialties, incidents |
| `handoffs` | patients, employees (sender/receiver), audit-events |
| `delegations` | employees (delegator/delegate), audit-events |

Regras obrigatórias ao registrar uma nova relação:

1. A relação precisa ser bidirecional no `entity-resolver.ts` —
   se `prescriptions` mostra o paciente, `patients` deve mostrar
   as prescrições.
2. A relação precisa respeitar `allowedRoles` — um papel que não
   pode ver `incidents` não verá a referência a incidentes no
   detalhe do paciente.
3. A relação não pode quebrar a classificação de sensibilidade —
   um usuário com acesso a classe A não ganha acesso a classe D
   por transitividade.
4. Toda relação exibida deve ser justificada por um campo real no
   store, nunca inferida por heurística de nome.

---

## 6. Mecanismos de encontrabilidade

### 6.1 Busca global (já existe)

**Componente:** `<CommandPalette>` em
`apps/web/src/app/components/command-palette.tsx`.

- Atalho: `⌘K` (Mac) ou `Ctrl+K` (Windows/Linux).
- Faz fuzzy match contra a constante `MODULES` do manifest,
  contra uma lista de ações rápidas (ex.: "Novo paciente", "Ver
  alertas"), e contra os recents.
- Navega via `router.push(href)`.
- O AI Assistant `<AiAssistantPanel>` usa atalho `⌘J` e tem uma
  janela flutuante separada — não é a mesma coisa que o Command
  Palette.

**Como adicionar um novo comando:**

1. Abra `command-palette.tsx`.
2. Adicione uma entrada na lista `QUICK_ACTIONS`:
   ```ts
   { id: 'new-consent', label: 'Novo consentimento',
     icon: '✍', href: '/governance/consent-forms/new',
     keywords: ['consent', 'lgpd', 'termo'] }
   ```
3. Se for específico a um papel, use o campo `requiredAction` e a
   helper `canPerformAction()`.
4. Todo comando é automaticamente indexado no fuzzy match.

### 6.2 Busca contextual (já existe)

**Componente:** `<ModuleListView>`, campo `<input type="search">`
no cabeçalho da tabela.

- Filtra linhas pelo resultado de `JSON.stringify(row).toLowerCase().includes(query)`.
- Age sobre o dataset já filtrado pelos demais filtros (AND lógico).
- Rende com feedback `aria-live="polite"` informando o número de
  resultados.
- Para adicionar busca em uma nova coluna, nada é necessário — qualquer
  coluna stringificável é buscável automaticamente.
- Para coluna com semântica de busca dedicada (ex.: MRN do paciente),
  o manifest pode declarar um filtro `{ key: 'patientMrn', type: 'search' }`
  que renderiza um input próprio.

### 6.3 Filtros e refinadores (já existe)

**Estrutura:** `module-manifest.filters[]` com
`{ key, label, type: 'select' | 'search', options? }`.

- `type: 'select'` → dropdown. Se `options` for omitido, as opções
  são extraídas como `Array.from(new Set(rows.map(r => r[key])))`.
- `type: 'search'` → text input.
- O `<ModuleListView>` renderiza em uma toolbar horizontal acima da
  tabela. Os filtros combinam com AND.
- Cada filtro aplicado reduz os `options` dos demais (semântica de
  faceta, não independente).

**PROPOSTA: persistir em URL via `useSearchParams`**

Hoje os filtros vivem em React state. Isso tem três problemas:

1. Não sobrevivem a refresh (F5).
2. Não são compartilháveis ("manda um print do que você está vendo"
   é um fluxo que vemos com frequência).
3. Não disparam analytics de qual combinação é mais usada.

A proposta é migrar `<ModuleListView>` para usar `useSearchParams()`
e `router.replace(url, { scroll: false })`. Ver seção 11.1 para
detalhes de implementação.

### 6.4 Descoberta orientada

- **Recentes (já existe).** `recent-patients.ts` armazena até 10
  MRNs em `localStorage`, com evento custom para sincronizar
  componentes. Hoje cobre apenas pacientes.

  **PROPOSTA: expandir para `recent-entities.ts` genérico.** Mesmo
  padrão (`{ entityType, entityId, label, openedAt }`, cap 30 no
  total, cap 10 por tipo), mas aceitando qualquer entidade. O
  `<PatientQuickSwitcher>` continua usando apenas MRNs, mas o
  Command Palette passa a indexar todos os recents. Arquivo:
  `apps/web/src/app/components/recent-entities.ts`.

- **Favoritos (proposta).** Hoje inexistente. Proposta:
  - Arquivo: `apps/web/src/app/components/favorites-store.ts`
  - Backing store: `/api/favorites` (file-backed JSON por usuário,
    mesmo padrão do `handoff-store.ts`), com fallback para
    `localStorage` quando offline.
  - Hook: `useFavorites(scope?: string)` retorna a lista filtrada
    por scope (ex.: `scope="patients"` para só pacientes favoritos).
  - UI:
    - Botão estrela em toda detail page (toggle).
    - Badge de contagem no topbar, abrindo drawer lateral.
    - Seção "Favoritos" na home `/`.
  - Compartilhamento cross-device via `/api/favorites` backend.

- **Acompanhando / following (proposta).** Suscrição ativa a mudanças
  de um registro específico. Diferente de favorito, que é um bookmark,
  o following dispara notificações.
  - Arquivo: `apps/web/src/app/components/following-store.ts`
  - Backing store: `/api/following` (mesmo padrão).
  - Quando um evento de mudança chega via `event-store.ts`, usuários
    que seguem o registro recebem uma notificação no bell do topbar.
  - Uso típico: seguir um paciente crítico, seguir uma ordem de
    compra pendente de aprovação, seguir um work order em execução.

- **Compartilhados comigo (futuro).** Registros que outro usuário
  enviou explicitamente para mim via delegação ou handoff — já
  existe em `/handoffs` e `/delegations`, mas poderia ser
  agregado em uma aba "Para mim" no `/me`.

---

## 7. Componentes de interface (catálogo padronizado)

Todo componente reutilizável de navegação ou interface geral vive em
`apps/web/src/app/components/`. Esta lista é o catálogo oficial. Não
crie variantes novas — estenda os existentes ou proponha alteração
via ADR.

| Componente | Arquivo | Propósito | Quando usar |
|---|---|---|---|
| `<AppShell>` | `app-shell.tsx` | Casca da aplicação (sidebar + topbar + main) | Wrap de toda página autenticada; nunca usar em `/login` |
| `<Navigation>` | `navigation.tsx` | Sidebar com agrupamento por seção e filtragem por papel | Sempre via `<AppShell>` |
| `<CommandPalette>` | `command-palette.tsx` | Busca global ⌘K, navega e executa ações | Montado globalmente no `<AppShell>`; nunca isolar |
| `<AiAssistantPanel>` | `ai-assistant-panel.tsx` | Painel flutuante do assistente IA (⌘J) | Montado globalmente; respeita `ai-permissions.ts` |
| `<ToastProvider>` | `toast-provider.tsx` | Sistema de toasts globais via context | Wrap acima do `<AppShell>` em `layout.tsx` |
| `<ShortcutsHelp>` | `shortcuts-help.tsx` | Modal com lista de atalhos de teclado | Aberto pelo atalho `?`; global |
| `<PatientQuickSwitcher>` | `patient-quick-switcher.tsx` | Dropdown de pacientes recentes no topbar | Somente no topbar, único por app |
| `<ModuleListView>` | `module-list-view.tsx` | List view genérica para todo módulo com sort/filter/search/export | Toda tela list de módulo do manifest |
| `<ErrorBoundary>` | `error-boundary.tsx` | Captura erros React, exibe fallback com retry | Wrap por página; um por rota crítica |
| `<ErrorReporter>` | `error-reporter.tsx` | Envia erros capturados para `/api/errors` com trace ID | Montado globalmente |
| `<FormField>` | `form-field.tsx` | Wrapper de campo de formulário com label, help, error, required | Toda entrada de formulário |
| `<PatientAutocomplete>` | `patient-autocomplete.tsx` | Autocomplete de paciente por nome ou MRN | Formulários que referenciam paciente |
| `<MedicationAutocomplete>` | `medication-autocomplete.tsx` | Autocomplete de medicação por nome ou princípio ativo | Formulários de prescrição |
| `<AllergyAlert>` | `allergy-alert.tsx` | Aviso contextual de alergia cruzada | Acima de formulários de prescrição |
| `<News2Calculator>` | `news2-calculator.tsx` | Calculadora interativa do escore NEWS2 | `/tools/sepsis` e tela de paciente |
| `<News2RiskPanel>` | `news2-risk-panel.tsx` | Painel de risco NEWS2 com distribuição | Home `/` e dashboards |
| `<RelatedItems>` (proposto) | `related-items.tsx` | Bloco de entidades relacionadas dinamicamente | Toda detail page a partir do P0 |
| `<Breadcrumbs>` (proposto) | `breadcrumbs.tsx` | Cadeia Categoria → Módulo → Registro derivada do manifest | Toda página (list, detail, edit) |
| `<FavoritesDrawer>` (proposto) | `favorites-drawer.tsx` | Drawer lateral listando favoritos por tipo | Topbar, aberto pelo badge de estrela |
| `<FollowingBadge>` (proposto) | `following-badge.tsx` | Botão "seguir" com estado on/off | Toda detail page |

---

## 8. Fluxos canônicos

Os oito fluxos a seguir são os trajetos mais frequentes no aplicativo.
Cada um foi desenhado para cumprir os 15 princípios da seção 2 e cada
um deve ser testado em E2E via Playwright. Dois fluxos (1 e 4) são
parte do quality gate de release.

### Fluxo 1 — Do alerta crítico ao paciente ao medicamento

1. Usuário faz login e aterrisa na home `/` (`<AppShell>` resolve a
   sessão via `/api/auth/session`).
2. A home mostra `<News2RiskPanel>` com a lista de pacientes em
   risco alto. O usuário clica no paciente MRN-013.
3. Rota: `/patients/MRN-013`. A detail page carrega, e
   `recent-patients.ts` é chamado com `pushRecentPatient('MRN-013')`.
4. A sidebar `Pacientes` fica marcada como `aria-current="page"`.
   O topbar atualiza o título para "MRN-013 — João da Silva".
5. O usuário clica na seção "Prescrições ativas" dentro da detail.
6. Rota: `/prescriptions?patientMrn=MRN-013` (filtro persistido em
   URL — proposto). A lista mostra apenas prescrições desse paciente.
7. O usuário clica numa prescrição. Rota: `/edit/prescriptions/RX-4523`.
   A tela de edição mostra o campo + a sidebar de histórico auditado
   à direita.
8. O usuário clica em "← Voltar". Volta para
   `/prescriptions?patientMrn=MRN-013` com o filtro preservado.
9. O usuário clica no MRN da prescrição. Volta para `/patients/MRN-013`.
   O contexto do paciente é recuperado integralmente.

**Princípios cobertos:** 5, 8, 9, 10, 13.

### Fluxo 2 — Busca global resolvendo por comando

1. O usuário pressiona `⌘K` em qualquer tela.
2. O `<CommandPalette>` abre com foco no campo de busca.
3. O usuário digita "prescrição amoxicilina".
4. O fuzzy match casa contra a ação "Abrir Prescrições" + contra
   a palavra-chave "amoxicilina" no índice.
5. O usuário aperta Enter na primeira opção.
6. Rota: `/prescriptions?q=amoxicilina`. A busca interna do
   `<ModuleListView>` é pré-preenchida com "amoxicilina".
7. A lista filtrada mostra 3 resultados. `aria-live` anuncia
   "3 resultados encontrados".

**Princípios cobertos:** 14, 15.

### Fluxo 3 — Tarefa pendente no /me

1. O usuário clica no avatar no topbar. Rota: `/me`.
2. A tela mostra 3 colunas: Tarefas, Notificações, Histórico.
3. Em "Tarefas" há um item "Adicionar nota em MRN-042 (vencido
   há 2h)". O usuário clica.
4. Rota: `/patients/MRN-042#notes`. A detail abre com o painel
   de notas expandido.
5. O usuário escreve a nota e clica "Salvar".
6. `POST /api/entities/patients/MRN-042/notes` é chamado.
7. Um toast verde aparece: "Nota registrada. Task concluída."
8. O `<ToastProvider>` injeta o toast; `useRecentPatients` atualiza.
9. O usuário volta para `/me` e a task sumiu da coluna Tarefas.

**Princípios cobertos:** 6, 7, 13.

### Fluxo 4 — Passagem de plantão I-PASS

1. Médico de plantão abre `/handoffs`. Tab "Enviadas" selecionada.
2. Clica em "+ Nova passagem". Rota: `/handoffs/new`.
3. A tela mostra um formulário estruturado com os 5 campos do
   I-PASS: **I**llness severity, **P**atient summary, **A**ction list,
   **S**ituation awareness, **S**ynthesis by receiver.
4. O campo "Receptor" é um `<PatientAutocomplete>`... na verdade,
   um autocomplete de profissionais (componente próprio). O usuário
   digita "Dr. Ribeiro", seleciona.
5. Cada campo tem indicador de progresso "preenchido / total".
6. O médico clica "Enviar". `POST /api/handoffs` é chamado, que
   persiste via `handoff-store.ts` e publica um evento em
   `event-store.ts`.
7. O receptor Dr. Ribeiro vê o handoff aparecer em
   `/handoffs?inbox=true` na próxima abertura (ou via notificação
   se estiver online).
8. O receptor abre, lê, faz o read-back (campo obrigatório) e clica
   "Confirmar leitura". Status passa para `completed`.
9. O ciclo de auditoria via `audit-logger.ts` registra toda ação:
   envio, leitura, read-back, conclusão.

**Princípios cobertos:** 1, 2, 5, 6, 9, 11.

### Fluxo 5 — Especialidade → staff → paciente

1. Usuário abre `/specialties`. Lista de 55 especialidades CFM.
2. Clica em "Cardiologia". Rota: `/specialties/cardiologia`.
3. A detail mostra "Funcionários envolvidos" e "Alas onde atua".
4. Clica em "Dr. Ana Pereira" → `/employees/EMP-1001`.
5. A detail do médico mostra credenciais, delegações, handoffs
   recentes e pacientes atribuídos.
6. Clica em MRN-013 → `/patients/MRN-013`.
7. O `recent-patients` agora tem MRN-013 no topo.

**Princípios cobertos:** 3, 8, 9, 15.

### Fluxo 6 — Ativo com falha → work order → manutenção

1. Usuário abre `/assets`. Filtra por `type=ventilador`.
2. Identifica um equipamento com `status=out-of-order`.
3. Clica no ID. Detail do ativo abre.
4. Clica em "Criar ordem de manutenção". Formulário pré-preenchido
   com `assetId` apontando para o ativo.
5. Submete. Rota: `/facility/work-orders?assetId=AST-7712`.
6. A lista mostra a nova ordem no topo. A coluna `assetId` tem
   `linkTo: '/assets#${row.assetId}'`, permitindo voltar ao ativo.

**Princípios cobertos:** 7, 9.

### Fluxo 7 — Break-glass e auditoria

1. Usuário clínico precisa acessar um paciente fora do seu escopo
   normal (emergência).
2. Ao tentar abrir `/patients/MRN-099`, recebe prompt de break-glass.
3. Justifica o acesso. `POST /api/break-glass` registra.
4. Acessa o paciente. Toda leitura é auditada em
   `audit-events`.
5. Mais tarde, auditor abre `/governance/audit-events` filtrado por
   `action=break-glass`. Vê a justificativa, o ator, o paciente, o
   timestamp e o IP.

**Princípios cobertos:** 11 (segurança por design).

### Fluxo 8 — Mobile em 360px

1. Usuário abre o app no celular. A sidebar está fechada.
2. Toca no hamburguer. Sidebar desliza da esquerda, com backdrop
   escuro tocável para fechar.
3. Toca em "Pacientes". A sidebar fecha automaticamente.
4. A lista de pacientes vira cards verticais (tabela não cabe).
5. Toca em um paciente. Detail abre tela cheia.
6. Toca no botão "← Voltar" do browser OU faz swipe direito.
   Volta para a lista com o scroll preservado.

**Princípios cobertos:** 12, 13.

---

## 9. Perfis e experiências por papel

A matriz abaixo descreve como cada papel profissional (do
`ROLE_DEFINITIONS` em `access-control.ts`) enxerga o aplicativo. Os
IDs entre parênteses são os `professionalRole` reais usados no
manifest.

| Papel | Home | Atalhos prioritários | Módulos visíveis | Ações frequentes | AI capabilities |
|---|---|---|---|---|---|
| Médico assistente (`medical_staff_attending`) | `/` (Centro de Comando) | `⌘K`, `⌘J`, `P` → pacientes | Assistencial + Diagnóstico + Prescrições + Handoffs | Prescrever, revisar lab, passar plantão | Sugestão diagnóstica, revisão de prescrição (advisory only, ver `ai-permissions.ts`) |
| Médico de plantão (`medical_staff_on_call`) | `/` | `⌘K`, `H` → handoffs | Mesma que assistente + Ambulâncias | Triagem, handoff, alta | Triagem assistida |
| Enfermeiro (`nurse`) | `/tasks` | `⌘K`, `T` → tarefas | Pacientes, Prescrições (só ver), Lab, Tarefas, Transporte | Checar sinais, administrar, delegar | Priorização de tarefas |
| Farmacêutico clínico (`pharmacist_clinical`) | `/pharmacy/stock` | `⌘K` | Farmácia, Prescrições, Supply Items | Liberar, conferir interações | Revisão de dose/interação |
| Técnico de laboratório (`lab_staff`) | `/lab/orders` | `⌘K` | Lab Orders/Results | Registrar resultados | Flagging crítico |
| Técnico de imagem (`imaging_staff`) | `/imaging/orders` | `⌘K` | Imaging Orders/Results | Laudar, sinalizar | Priorização de laudos |
| Recepção (`receptionist_registration`) | `/patients` | `P` → pacientes | Pacientes, Consent Forms | Cadastrar, colher consentimento | — |
| Maqueiro (`patient_transporter`) | `/transport/orders` | — | Transport Orders | Aceitar, iniciar, concluir | — |
| Higienização (`cleaning_hygiene`) | `/cleaning/tasks` | — | Cleaning Tasks, Waste Manifests | Marcar concluído | — |
| Bed management (`bed_management`) | `/beds` | — | Beds, Wards, Cleaning Tasks, Transport | Atribuir leito | Sugestão de alocação |
| Nutricionista (`nutritionist`) | `/meals/orders` | — | Meal Orders, Pacientes (só ver) | Prescrever dieta | — |
| Autorizador de faturamento (`billing_authorization`) | `/billing/charges` | — | Charges, Claims, Denials, Purchase Orders | Autorizar, contestar glosa | Sugestão de codificação (shadow) |
| Auditor de compliance (`compliance_auditor`) | `/governance/audit-events` | — | Audit Events, Credentials, Incidents, Consent Forms | Rever logs, abrir incidentes | Análise de padrões anômalos |
| Administrador do sistema (`admin_system`) | `/` | `⌘K` | Tudo | Gerir cadastros mestres | Tudo (c/ governance) |
| Motorista de ambulância (`ambulance_driver`) | `/ems` | — | EMS | Aceitar chamada, atualizar status | — |

As capacidades de IA por papel são controladas em
`apps/web/src/lib/ai-permissions.ts` via `AI_ROLE_POLICIES`. Toda
resposta de IA exibida precisa carregar nível de confiança,
evidências e timestamp de dados, conforme `.claude/rules/ai-safety.md`.

---

## 10. Governança de campos, cadastros e estados

Esta seção define o passo-a-passo canônico para alterações na
navegação, garantindo que toda mudança passe pelos mesmos pontos de
controle e deixe rastro no audit chain.

### Adicionar um novo módulo

1. Abra `apps/web/src/lib/module-manifest.ts`.
2. Adicione uma entrada `ModuleDef` ao array `MODULES`, respeitando
   o schema. Campos obrigatórios: `id`, `route`, `title`, `subtitle`,
   `category`, `fhirResource`, `dataClass`, `allowedRoles`,
   `fixturePath`, `fixtureExport`, `icon`, `columns`.
3. Crie o fixture em `apps/web/src/lib/fixtures/<module-id>.ts`.
4. Crie um page wrapper enxuto de 6 linhas em
   `apps/web/src/app/<route>/page.tsx`:
   ```tsx
   import { ModuleListView } from '../components/module-list-view';
   import { getModuleById } from '@/lib/module-manifest';
   export default function Page() {
     return <ModuleListView module={getModuleById('my-module-id')!} />;
   }
   ```
5. Registre no `FIXTURE_REGISTRY` de
   `apps/web/src/lib/entity-resolver.ts` para que a API
   `/api/entities/[moduleId]` o reconheça.
6. Adicione a entrada correspondente em
   `apps/web/src/app/components/navigation.tsx` (array `NAV_ITEMS`).
7. Adicione uma linha em `docs/product/hospital-modules-map.md`.
8. Abra um PR. CI vai validar que não há colisão de `route`, que o
   fixture casa com o `fhirResource`, e que o manifest permanece
   válido.

### Adicionar um novo campo

1. No `ColumnDef` do módulo no manifest, adicione:
   ```ts
   { key: 'newField', label: 'Novo campo', editable: true,
     inputType: 'text', help: 'Descrição curta', required: false }
   ```
2. Atualize o fixture com valores do novo campo.
3. Atualize o type TypeScript da entidade em
   `apps/web/src/lib/fixtures/<module>.ts`.
4. Se for sensível, atualize a classe de dado do módulo.
5. A tela de edição `/edit/[moduleId]/[recordId]` pega o novo campo
   automaticamente via `getEditableColumns()`.

### Adicionar um novo status

1. Na coluna relevante do manifest, adicione ao array `options`:
   ```ts
   options: [
     { value: 'pending',   label: 'Pendente' },
     { value: 'approved',  label: 'Aprovado' },
     { value: 'rejected',  label: 'Rejeitado' },
     { value: 'cancelled', label: 'Cancelado' }, // novo
   ]
   ```
2. Se o badge precisa de cor específica, registre a cor em
   `apps/web/src/app/components/module-list-view.tsx` no helper
   `badgeColor(value)`.
3. Garanta que o filtro `{ key: 'status', type: 'select' }` do
   módulo reflete a nova opção automaticamente (ele não precisa de
   alteração — o `<ModuleListView>` extrai os valores do dataset).
4. Se o status dispara notificações ou eventos, registre-o em
   `apps/web/src/lib/event-store.ts`.

### Adicionar um novo papel

1. Em `apps/web/src/lib/access-control.ts`, adicione entrada em
   `ROLE_DEFINITIONS` com `id`, `label`, `accessLevel`,
   `professionalCouncil` (se aplicável), `defaultSection`.
2. Atualize `PROFESSIONAL_ROLES` (tipo union).
3. Em `AI_ROLE_POLICIES` (`apps/web/src/lib/ai-permissions.ts`),
   adicione as capacidades de IA do novo papel.
4. Atualize a matriz da seção 9 deste documento.
5. Atualize o fluxo de onboarding (tela `/login` e criação de
   usuário em `apps/web/src/lib/user-store.ts`).
6. Adicione testes de autorização para rotas sensíveis.

### Audit chain

Toda mudança na navegação (criação, atualização, exclusão,
visualização) passa por `apps/web/src/lib/audit-logger.ts`, que
mantém uma hash chain SHA-256:

```
event_n.hash = SHA256(event_n.payload + event_{n-1}.hash)
```

Essa estrutura garante que qualquer adulteração retroativa quebra
a cadeia de integridade. A cadeia é verificável por
`/api/audit/verify` e é usada pelos auditores em
`/governance/audit-events`.

---

## 11. Regras técnicas para implementação

### 11.1 Frontend

- **Stack**: Next.js 15 App Router, React 19, TypeScript em modo
  `strict: true`.
- **Roteamento**: file-based, dynamic segments `[moduleId]`,
  `[recordId]`, `[id]`. Rotas privadas dentro do `<AppShell>`, rotas
  públicas (`/login`, `/error`) fora.
- **Client vs Server Components**: padrão server, com `'use client'`
  apenas quando há state local, handlers, efeitos, ou uso de hooks
  como `useRouter`, `useSearchParams`, `useState`. O `<ModuleListView>`
  é client (sort e filtro locais). A tela de edição também é client.
- **Suspense + Error Boundary por rota**: toda rota tem um
  `error.tsx` e (quando faz sentido) um `loading.tsx`. O
  `<ErrorBoundary>` global serve de rede de segurança para
  componentes filhos.
- **URL como fonte de verdade para filtros** (proposta P0). Patch
  no `<ModuleListView>`:
  ```tsx
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentFilters = useMemo(() => {
    const out: Record<string, string> = {};
    module.filters?.forEach((f) => {
      const v = searchParams.get(f.key);
      if (v) out[f.key] = v;
    });
    return out;
  }, [searchParams, module.filters]);

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  ```
- **`localStorage` apenas para preferências locais**: recents,
  futuros favoritos offline, preferências de paginação. Nunca PHI.
- **Server state via `fetch`** com `credentials: 'same-origin'` e
  sempre com validação Zod nas respostas. Nada de SWR/React Query
  neste momento — o fetch manual é suficiente.
- **Links internos**: sempre `<Link href>` do Next. `router.push`
  apenas em handlers programáticos.

### 11.2 Backend e APIs

- **Padrão REST sob `/api/*`**. Rotas agrupadas em
  `apps/web/src/app/api/` por domínio: `/auth`, `/entities`,
  `/patients`, `/handoffs`, `/delegations`, `/alerts`,
  `/break-glass`, `/audit`, `/errors`, `/events`, `/me`.
- **Middleware**. Aplica security headers (CSP, X-Frame-Options,
  HSTS), rate limiting por IP e por sessão, CSRF token em
  formulários mutáveis (POST/PATCH/DELETE).
- **Sessão**. Cookie HttpOnly, Secure, SameSite=Lax, assinado.
  Implementação em `apps/web/src/lib/auth-session.ts`. Handler
  em `/api/auth/session` usado pelo `<AppShell>`.
- **Rota genérica de entidade**: `/api/entities/[moduleId]` e
  `/api/entities/[moduleId]/[recordId]`. Suporta `GET` (lista/detalhe),
  `PATCH` (atualização parcial), `DELETE` (soft delete). Valida
  `allowedRoles` e `editorRoles` via `canEditModule()`.
- **PROPOSTA: `/api/related/[type]/[id]`**. Devolve o grafo
  reduzido descrito na seção 3.4. Implementado por lookup no
  `FIXTURE_REGISTRY` + regras da matriz da seção 5. Response
  cacheável por 30s.
- **PROPOSTA: `/api/favorites` e `/api/recents`**. Server-side
  para sincronização cross-device. Cada um um endpoint REST
  simples com GET/POST/DELETE. Backing em file-backed JSON por
  usuário, como `handoff-store.ts` faz hoje.

### 11.3 Dados e modelagem

- **IDs estáveis por entidade** via prefixos:
  `MRN-` para pacientes (Medical Record Number), `EMP-` para
  funcionários, `AST-` para ativos, `RX-` para prescrições,
  `LAB-` para lab orders, `WO-` para work orders, etc. IDs
  nunca são reutilizados.
- **FHIR R4 como modelo canônico**. A coluna `fhirResource` no
  manifest declara o recurso FHIR de referência. Qualquer
  transformação entre shape interno e FHIR é feita na camada
  ACL (`services/integrations/`). Ver
  `docs/product/hospital-modules-map.md`.
- **Audit chain por mudança de campo**. Toda atualização via
  `/api/entities/[moduleId]/[recordId]` dispara um evento
  em `audit-events` com `field`, `previousValue`, `newValue`,
  `actor`, `timestamp`, `hash`, `prevHash`.
- **Soft delete**. Nenhum registro é fisicamente removido. Um
  campo `deletedAt` marca o registro como arquivado, e
  `GET /api/entities/[moduleId]` por padrão filtra registros
  arquivados (override via `?includeDeleted=true` com permissão
  de auditor).
- **Idempotência**. Toda rota de escrita aceita header
  `X-Idempotency-Key`. Uma chave repetida dentro de 24h devolve
  a resposta anterior sem duplicar o efeito. Padrão herdado
  de `.claude/rules/architecture.md`.

---

## 12. Permissão e segurança

- **Role-based**. Cada módulo declara `allowedRoles` (leitura) e
  `editorRoles` (escrita) no manifest. `canEditModule()` em
  `module-manifest.ts` verifica se o papel atual passa.
- **Email allowlist para admin**. A variável de ambiente
  `AI_ADMIN_EMAILS` (`.env`) contém uma lista separada por vírgula;
  qualquer email nessa lista tem acesso administrativo pleno,
  independente de papel. É o mecanismo de break-glass de desenvolvimento.
- **Audit por categoria**. O `audit-logger.ts` classifica eventos
  por categoria: `frontend`, `api`, `backend`, `infra`, `agent`,
  `system`. Dashboards de compliance filtram por categoria.
- **Break-glass** para acesso fora do escopo normal. Justifica e
  registra em `audit-events` com `action=break-glass`.
- **LGPD**. Módulos classe D/E só mostram campos de PHI quando o
  papel atual tem direito explícito. Em telas compartilhadas (ex.:
  recentes), mostra apenas o MRN, nunca o nome completo.
- **CSP e headers**. Middleware aplica
  `Content-Security-Policy: default-src 'self'` com allowlist
  explícita para scripts. `X-Frame-Options: DENY`.
- **Ver `docs/security/threat-model.md`** para o modelo de ameaças
  completo e `docs/architecture/security-baseline.md` para a
  baseline de infraestrutura.

---

## 13. Observabilidade de navegação

Hoje a Velya audita eventos de escrita e leitura sensível. O
**backlog proposto** adiciona uma camada de audit para eventos de
navegação, alimentando dashboards de UX e detecção de padrões
anômalos.

Os eventos a registrar, todos via `audit-logger.ts` na categoria
`frontend`:

| Evento | Payload | Uso |
|---|---|---|
| `nav.click` | `{ fromRoute, toRoute, durationMs }` | Matriz de transições, latência de páginas |
| `nav.search` | `{ query, resultCount, moduleId }` | Detectar buscas vazias (sinal de nomenclatura ruim) |
| `nav.filter-apply` | `{ moduleId, filterKey, filterValue }` | Identificar combinações populares, otimizar ordem de filtros |
| `nav.deeplink-shared` | `{ recordId, channel }` | Medir uso de URLs compartilhadas |
| `nav.command-palette-open` | `{}` | Engajamento com ⌘K |
| `nav.command-palette-execute` | `{ commandId, matchRank }` | Saber quais comandos são usados, rankear fuzzy |
| `nav.recents-jump` | `{ entityType, entityId }` | Validar que recents estão ajudando |
| `nav.favorite-toggle` | `{ entityType, entityId, on }` | Identificar registros mais favoritados |
| `nav.error-boundary-triggered` | `{ route, errorMessage, stack }` | Correlacionar com incidentes reais |

Esses eventos **nunca** incluem PHI. Em particular:

- `nav.search.query` sofre redaction de números que pareçam MRN
  antes de ir ao log.
- `nav.recents-jump.entityId` é hash SHA-256 quando o entityType
  é `patient`.
- `nav.deeplink-shared.recordId` é hash SHA-256 sempre.

Os eventos alimentam um dashboard em
`/governance/audit-events?category=frontend` filtrado por
`action` começando com `nav.`.

---

## 14. Métodos de validação

A navegação só é boa quando é validada por usuários reais. Os
métodos abaixo são obrigatórios semestralmente.

- **Card sorting**. Dar aos participantes (8 usuários representativos
  dos principais papéis) os 23 nomes de módulo em cartões e pedir
  que os agrupem livremente. Comparar os grupos com as 9 categorias
  atuais. Meta: concordância ≥ 70%. Ferramenta: Optimal Workshop.
- **Tree testing**. Apresentar a árvore de menu atual e pedir que
  o usuário encontre 5 itens-alvo: "onde você registraria uma
  glosa?", "onde você vê o estoque de amoxicilina?", etc. Meta:
  sucesso ≥ 80% em ≤ 3 cliques.
- **Telemetria via audit log**. Uma vez implementados os eventos
  `nav.*` da seção 13, rodar consultas semanais:
  - Top 10 transições `fromRoute → toRoute`.
  - Buscas com zero resultados (indica falha de nomenclatura).
  - Páginas com maior taxa de erro boundary.
  - Combinações de filtros mais comuns (candidatas a preset).
- **Heatmap (futuro)**. Ferramenta a definir. Apenas em staging,
  nunca em produção com PHI. Validar onde o usuário clica vs onde
  é relevante.
- **Revisão semestral por papel**. Cada papel principal passa por
  uma sessão de 60 minutos de uso observado, com três tarefas
  pré-definidas. Resultado documentado em
  `docs/risk/assumption-log.md`.

---

## 15. Backlog priorizado

### P0 — este sprint

- [ ] Extrair `<Breadcrumbs>` como componente isolado
  (`apps/web/src/app/components/breadcrumbs.tsx`) derivado do
  manifest. Substituir a implementação inline do `<ModuleListView>`.
- [ ] Criar `<RelatedItems>`
  (`apps/web/src/app/components/related-items.tsx`) consumindo
  props `entityType` + `entityId` e renderizando grupos de
  relações. Ligar nas detail pages existentes.
- [ ] Criar `favorites-store.ts` + hook `useFavorites(scope?)` +
  botão estrela em todas as detail pages + drawer no topbar.
  Backing em `localStorage` só no P0; sync server no P1.
- [ ] URL filter persistence no `<ModuleListView>` via
  `useSearchParams` + `router.replace()`. Deprecate o state local.

### P1 — próximo sprint

- [ ] Backend `/api/related/[type]/[id]` com a matriz da seção 5
  implementada em cima do `FIXTURE_REGISTRY`.
- [ ] Following / subscribe a mudanças
  (`following-store.ts` + `/api/following`). Notificações via
  bell do topbar.
- [ ] Rota `/compare/[type]?a=...&b=...` para comparação entre
  duas entidades.
- [ ] Implementar os eventos `nav.*` de audit log da seção 13.
- [ ] `favorites-store` e `recent-entities` com sync server via
  `/api/favorites` e `/api/recents`.
- [ ] Sticky filter sidebar para listas com mais de 5 filtros
  (hoje só dropdown horizontal).

### P2 — próximo trimestre

- [ ] Rodar card sorting com 8 usuários reais.
- [ ] Rodar tree testing com os 5 cenários definidos.
- [ ] Revisar rótulos de IA com clínicos (confiança, evidência,
  linguagem de advisory vs autonomia).
- [ ] Semantic search no Command Palette via embeddings (provavelmente
  via `ai-gateway`), preservando rate limit e fallback quando
  offline.
- [ ] Onboarding tour por papel (5 passos guiados no primeiro
  login de cada role), com skip persistente em localStorage.
- [ ] Testes E2E dos 8 fluxos canônicos da seção 8 no Playwright.
- [ ] Cobertura de acessibilidade automática via axe-core em CI.

---

## 16. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Filtros perdidos no refresh | Usuário refaz o filtro toda vez, frustração | Persistir em URL via `useSearchParams` (P0) |
| Breadcrumb diferente do menu | Quebra o princípio 5 (previsibilidade) | Derivar breadcrumb do mesmo manifest que alimenta o menu |
| Recents lotados de pacientes irrelevantes | Quick switcher vira ruído | Cap de 10, dedup por MRN, botão "limpar" (já existe) |
| Sidebar overflow em mobile 360px | Menu fica scrollável horizontalmente, poluição | Drawer com altura 100vh, fecha ao tocar em item |
| URL compartilhada vaza PHI | Violação LGPD | Hash de IDs sensíveis em query strings de navegação; nunca colocar nome em URL |
| Command Palette com comando deprecado | Usuário navega para 404 | CI valida que todo `QUICK_ACTIONS.href` existe em `MODULES` ou em rota registrada |
| Favoritos em localStorage perdidos ao trocar de dispositivo | Frustração | Sync server via `/api/favorites` no P1 |
| Audit log crescendo descontroladamente por eventos `nav.*` | Custo de storage e de leitura | Retention de 30 dias para categoria `frontend`, contra anos para clínica |
| Breadcrumb quebrado em rotas dinâmicas (`/edit/[moduleId]/[recordId]`) | Usuário não sabe em que módulo está | Resolver `moduleId` no manifest e montar cadeia no próprio `<Breadcrumbs>` |
| RelatedItems mostrando entidades fora do escopo do papel | Quebra de autorização | Filtrar sempre por `allowedRoles` do módulo destino antes de retornar da API |
| Tabs internos sem URL deep-link | Usuário não consegue compartilhar visão específica | Converter tabs para `?tab=xyz` em telas com > 2 tabs |
| Following store crescendo indefinidamente | Ruído no bell | Auto-expiração de follows após 30 dias sem evento |
| Nomenclatura inconsistente entre manifest e navigation | Menu mostra nome diferente do título da página | CI check que casa `module.title` com `NAV_ITEMS[i].label` |
| Fuzzy match do Command Palette muito permissivo | Usuário confunde resultados | Pontuação mínima de match + separador visual entre tipos |

---

## 17. Fontes

Referências externas consultadas na elaboração deste documento:

- [Atlassian — Designing Atlassian's new navigation](https://www.atlassian.com/blog/design/designing-atlassians-new-navigation)
- [GOV.UK Design System — Breadcrumbs](https://design-system.service.gov.uk/components/breadcrumbs/)
- [Nielsen Norman Group — Breadcrumbs: 11 design guidelines](https://www.nngroup.com/articles/breadcrumbs/)
- [Next.js — Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [Atlassian — Confluence Information Architecture](https://www.atlassian.com/enterprise/data-center/confluence/organizing-confluence-information-architecture)

Referências internas relacionadas:

- `apps/web/src/lib/module-manifest.ts` — single source of truth dos 23 módulos.
- `apps/web/src/lib/access-control.ts` — papéis, seções, classes de dado.
- `apps/web/src/lib/ai-permissions.ts` — capacidades de IA por papel.
- `apps/web/src/lib/audit-logger.ts` — hash chain de auditoria.
- `apps/web/src/lib/entity-resolver.ts` — fixture registry para a API genérica.
- `apps/web/src/app/components/app-shell.tsx` — casca global.
- `apps/web/src/app/components/navigation.tsx` — sidebar por seção.
- `apps/web/src/app/components/module-list-view.tsx` — list view genérica.
- `apps/web/src/app/components/command-palette.tsx` — busca global ⌘K.
- `apps/web/src/app/components/recent-patients.ts` — recents de pacientes.
- `apps/web/src/app/components/patient-quick-switcher.tsx` — dropdown de recents.
- `apps/web/src/app/edit/[moduleId]/[recordId]/page.tsx` — edit genérica.
- `apps/web/src/app/specialties/[id]/page.tsx` — detail com relações.
- `docs/product/hospital-modules-map.md` — mapa módulo↔FHIR.
- `docs/architecture/velya-hospital-platform-overview.md` — visão geral da plataforma.
- `docs/architecture/security-baseline.md` — baseline de segurança.
- `.claude/rules/architecture.md` — regras arquiteturais.
- `.claude/rules/security.md` — regras de segurança.
- `.claude/rules/ai-safety.md` — regras de segurança da IA.

---

> Fim do documento. Revisão semestral pelo Plataforma Web Office.
> Última atualização: 2026-04-10.
